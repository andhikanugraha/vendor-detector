import * as dns from 'dns';
import * as url from 'url';

import { Search } from './Search';
import * as fetchNS from 'node-fetch';
import * as pify from 'pify';

import { Netmask } from 'netmask';

const dnsAsync = pify(dns);

export interface Vendor {
  // Do things like load IP address ranges
  // constructor(search: Search): void;
  init(): Promise<void>;
  detect(): Promise<DetectionResult[]>;
  results: DetectionResultSet;
}

export interface DetectionResult {
  certainty?: string;
  vendor?: string;
  product?: string;
  productCategories?: string[];
  region?: string;
  ipRange?: string;
  hostname?: string;
  url?: string;
  message?: string;
}

export class DetectionResultSet extends Array<DetectionResult> {
  private baseResult: DetectionResult;
  constructor(baseResult?: DetectionResult) {
    super();

    if (baseResult) {
      this.setBaseResult(baseResult);
    }
  }

  setBaseResult(baseResult: DetectionResult) {
    this.baseResult = baseResult;
  }

  push(result: any): number {
    return super.push({ ...this.baseResult, ...result });
  }
}

export const enum UrlSampling {
  One,
  All,
  RootHttp,
  RootHttps,
  Root = RootHttps
}

export const enum DetectionCertainty {
  Definite = 1,
  Probable = 0.5
}

export type HeaderDetectionRule =
  HeaderDetectionShorthand |
  HeaderDetectionRuleObject;

export type HeaderDetectionShorthand = any;

export interface HeaderDetectionRuleObject {
  header: string;
  urlSampling?: UrlSampling;
  match: string | RegExp;
  result?: DetectionResult;
}

export type HostnameDetectionRule =
  RegExp |
  HostnameDetectionRuleShorthand |
  HostnameDetectionRuleObject;

export interface HostnameDetectionRuleShorthand {
  endsWith: string;
  result?: DetectionResult;
}

export interface HostnameDetectionRuleObject {
  match: string | RegExp;
  result?: DetectionResult;
}

export interface IpRange {
  ipRange: string;
  netmask?: Netmask;
  region?: string;
}

export class BaseVendor implements Vendor {
  readonly results: DetectionResultSet = new DetectionResultSet();
  readonly baseResult: any = {};

  headerDetectionRules: HeaderDetectionRule[] = [];
  hostnameDetectionRules: HostnameDetectionRule[] = [];

  productCategories?: string[];

  readonly sampleUrls = new Map<string, string>();

  readonly intermediateByHostname = new Map<string, any>();

  private search: Search;

  ipRanges: IpRange[] = [];

  constructor(search: Search) {
    this.search = search;
  }

  async init(): Promise<void> {
    const ctor: any = this.constructor; // the class inheriting this class
    if (!ctor.init) {
      return;
    }

    await ctor.init(async (url: string, options?: any) => this.fetch(url, options));
    if (ctor.ipRanges) {
      this.ipRanges = ctor.ipRanges.map(range => {
        if (range.ipRange) {
          range.netmask = new Netmask(range.ipRange);
        }

        return range;
      });
    }
  }

  async detect(): Promise<DetectionResultSet> {
    this.results.setBaseResult({
      vendor: this.constructor.name,
      productCategories: this.productCategories,
      ...this.baseResult
    });

    this.expandHeaderDetectionRuleShorthand();
    this.populateSampleUrls();

    this.applyHostnameDetectionRules();
    await this.detectByIpv4Addresses();
    await this.applyHeaderDetectionRules();

    return this.results;
  }

  populateSampleUrls() {
    const rules = this.headerDetectionRules;

    let addedAll = false;
    let addedOne = false;
    let addedHttps = false;
    let addedHttp = false;

    // Added url samples
    rules.forEach((rule: HeaderDetectionRuleObject) => {
      const sampling = rule.urlSampling || UrlSampling.One;

      if (sampling === UrlSampling.All && !addedAll) {
        this.search.urlsByHostname.forEach((urls, hostname) => {
          urls.forEach(sampleUrl => this.sampleUrls.set(sampleUrl, hostname));
        });
        addedAll = true;
      }
      else if (!addedAll && !addedOne) {
        this.search.urlsByHostname.forEach((urls, hostname) => {
          const sampleUrl = urls.values().next().value;
          this.sampleUrls.set(sampleUrl, hostname);
        });
        addedOne = true;
      }
      if (sampling === UrlSampling.RootHttps && !addedHttps) {
        this.search.hostnames.forEach(host => {
          const sampleUrl = 'https://' + host;
          this.sampleUrls.set(sampleUrl, host);
        });
        addedHttps = true;
      }
      if (sampling === UrlSampling.RootHttp && !addedHttp) {
        this.search.hostnames.forEach(host => {
          const sampleUrl = 'http://' + host;
          this.sampleUrls.set(sampleUrl, host);
        });
        addedHttp = true;
      }
    });
  }

  async detectByIpv4Addresses(): Promise<void> {
    const ctor: any = this.constructor;
    if (ctor.ipRanges) {
      this.ipRanges = ctor.ipRanges;
    }

    if (this.ipRanges.length === 0 || this.search.resolvedHostnames.length === 0) {
      return;
    }

    const resolvedHostnames: [string, string][] = this.search.resolvedHostnames;

    let resolvedHostnameCursor = 0;
    let ipRangeCursor = 0;

    while (resolvedHostnameCursor < resolvedHostnames.length &&
           ipRangeCursor < this.ipRanges.length) {
      const currentResolvedHostname = resolvedHostnames[resolvedHostnameCursor];
      const currentIpRange = this.ipRanges[ipRangeCursor];
      const [hostname, addr] = currentResolvedHostname;
      const found = currentIpRange.netmask.contains(addr);

      if (found) {
        this.addResult({
          certainty: DetectionCertainty.Definite,
          hostname,
          region: currentIpRange.region,
          ipAddress: addr,
          ipRange: currentIpRange.ipRange
        });
        resolvedHostnameCursor++;
      }
      else {
        ipRangeCursor++;
      }
    }
  }

  applyHostnameDetectionRules(): void {
    const hostnameRules: HostnameDetectionRuleObject[] =
      // Expand shorthand syntax for header rules
      this.hostnameDetectionRules.map((rule: any): HostnameDetectionRuleObject => {
        if (rule instanceof RegExp) {
          return { match: rule, result: {} };
        }
        else if (rule.endsWith) {
          return { match: new RegExp(rule.endsWith.replace('.', '\\.') + '$'), result: rule.result };
        }
        return rule;
      });

    this.search.hostnames.forEach(hostname => {
      hostnameRules.forEach(rule => {
        if (this.matchHostname(hostname, rule.match)) {
          console.dir(rule);
          this.addResult({ hostname, certainty: DetectionCertainty.Definite, ...rule.result });
        }
      });
    });
  }

  matchHostname(hostname: string, match: string | RegExp): boolean {
    if (typeof match === 'string') {
      return !!hostname.match(match);
    }
    else {
      return !!match.exec(hostname);
    }
  }

  expandHeaderDetectionRuleShorthand(): void {
    // Expand shorthand syntax for header rules
    this.headerDetectionRules.forEach((rule, idx) => {
      if (Object.keys(rule).length === 1) {
        const header = Object.keys(rule)[0];
        const match = rule[header];
        this.headerDetectionRules[idx] = { header, match };
      }
    });
  }

  async applyHeaderDetectionRules(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];
    this.sampleUrls.forEach((sampleUrl, hostname) => {
      fetchPromises.push(this.applyHeaderDetectionRulesForUrl(hostname, sampleUrl));
    });

    await Promise.all(fetchPromises).catch(e => { /* throw e; */ });
  }

  async applyHeaderDetectionRulesForUrl(sampleUrl, hostname: string): Promise<void> {
    const response = await this.fetchHead(sampleUrl);
    if (!response || !response.headers) {
      // Request failed, no matter
      return;
    }

    const headers = response.headers;

    this.headerDetectionRules.forEach((rule: HeaderDetectionRuleObject) => {
      if (this.matchHeader(headers, rule.header, rule.match)) {
        const result: any = { certainty: DetectionCertainty.Definite, hostname };
        if (rule.urlSampling === UrlSampling.All) {
          result.url = sampleUrl;
        }
        Object.assign(result, rule.result);
        this.addResult(result);
      }
    });
  }

  addResult(result: any): void {
    this.results.push(result);
  }

  fetch(url: string, options?: any): Promise<fetchNS.Response> {
    return this.search.fetch(url, options);
  }

  fetchHead(url: string, options?: any): Promise<fetchNS.Response> {
    return this.fetch(url, {
      ...options,
      method: 'HEAD'
    }).catch(e => {});
  }

  matchHeader(headersObject: fetchNS.Headers, header: string, needle: string | RegExp): boolean {
    header = header.toLowerCase();

    if (!headersObject.has(header)) {
      return false;
    }

    if (typeof needle === 'string') {
      return !!headersObject.get(header).match(needle);
    }

    return !!needle.exec(headersObject.get(header));
  }
}
