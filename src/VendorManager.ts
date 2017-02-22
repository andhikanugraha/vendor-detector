import * as fs from 'graceful-fs';
import * as url from 'url';

import * as Vendor from './Vendor';
import { Search } from './Search';
import { Resolver, ResolverResult } from './Resolver';

import * as globby from 'globby';
import fetch from 'node-fetch';
import { Netmask, ip2long } from 'netmask';


import * as yaml from 'js-yaml';

export class VendorManager {
  static instance: VendorManager;
  static getInstance(): VendorManager {
    if (!VendorManager.instance) {
      VendorManager.instance = new VendorManager();
    }

    return VendorManager.instance;
  }

  vendors = new Map<string, Vendor.Vendor>();
  vendorImplications = new Map<string, string[]>();
  vendorExclusions = new Map<string, string[]>();

  // Canonized rules

  // "Outer"" rules
  hostnameRules: Vendor.HostnameRuleObject[];
  urlRules: Vendor.UrlRuleObject[];
  ipRangeRules: Vendor.IpRangeRule[];
  headerRules: Vendor.HeaderRuleObject[];
  dnsRules: Vendor.DnsRuleObject[];

  // "Inner" rules
  metaRules: Vendor.MetaRuleObject[];
  htmlRules: Vendor.HtmlRuleObject[];
  scriptRules: Vendor.ScriptRuleObject[];

  private constructor() {

  }

  async init(): Promise<void> {
    await this.loadVendorObjects();

    for (let item of this.vendors) {
      const [vendorName, vendorObj] = item;
      if (vendorObj.load) {
        const delta = await vendorObj.load();
        Object.assign(vendorObj, delta);
        // TODO scheduling
      }
    }

    this.loadRules();
    this.loadImplicationsAndExclusions();
  }

  private loadRules(): void {
    const ruleTypes = [
      'hostname',
      'url',
      'ipRange',
      'header',
      'dns',
      'meta',
      'html',
      'script'
    ];

    const sortBy = {
      // ipRangeRules: x => x.first,
      headerRules: x => x.headerName,
      metaRules: x => x.name
    };

    ruleTypes.forEach(ruleType => {
      const prop = ruleType + 'Rules';
      this[prop] = [];

      const canonizer = VendorRuleCanonizers[prop];

      this.vendors.forEach(vendorObj => {
        const baseResult = vendorObj.baseResult;
        vendorObj[prop].forEach(rule => {
          const canonizedRule: Vendor.VendorRuleObject = { ...canonizer(rule) };
          canonizedRule.result = {
            ...baseResult,
            ...canonizedRule.result
          };
          if (!canonizedRule.ruleType) {
            canonizedRule.ruleType = ruleType;
          }

          if (typeof canonizedRule.pattern === 'string') {
            canonizedRule.pattern = new RegExp(canonizedRule.pattern);
          }

          const sorter = sortBy[prop];
          if (sorter) {
            let i = 0;
            let inserted = false;
            while (i < this[prop].length && !inserted) {
              if (sorter(this[prop][i]) > sorter(canonizedRule)) {
                this[prop].splice(i, 0, canonizedRule);
                inserted = true;
              }
              else {
                i++;
              }
            }
            if (!inserted) {
              this[prop].push(canonizedRule);
            }
          }
          else {
            this[prop].push(canonizedRule);
          }
        });
      });
    });
  }

  private async loadVendorObjects(): Promise<void> {
    await this.loadWappalyzer();

    const jsFiles: Array<string> = await globby(__dirname + '/vendors/**/*.js'); // use *.js after compilation
    jsFiles.forEach(file => this.loadJs(file));

    const yamlFiles: Array<string> = await globby(__dirname + '/vendors/**/*.{yml,yaml}');
    yamlFiles.forEach(file => this.loadYaml(file));
  }

  private async loadWappalyzer() {
    // Load apps.json from GitHub instead of loading npm
    const WappalyzerAppsJsonUri = 'https://raw.githubusercontent.com/AliasIO/Wappalyzer/master/src/apps.json';
    const response = await fetch(WappalyzerAppsJsonUri);
    const responseJson = await response.json();
    const wappalyzerApps = responseJson.apps;
    Object.keys(wappalyzerApps).forEach(vendorName => {
      const convertedVendor = this.loadWappalyzerApp(vendorName, wappalyzerApps[vendorName]);
      this.mergeVendor(vendorName, convertedVendor);
    });
  }

  private loadWappalyzerApp(vendorName: string, appObj: any): Vendor.Vendor {
    const newVendor: Vendor.Vendor = {};

    const parseWappalyzerPattern = (pattern: string): RegExp => {
      // Parse Wappalyzer patterns
      // For now, implement only the product detection, ignore metadata
      // TODO: implement confidence level & version detection
      const splitPattern = pattern.split('\\;');
      return new RegExp(splitPattern[0]);
    };

    const parseWappalyzerLinkedVendor = (pattern: string): string => {
      // Parse Wappalyzer implies/excludes values
      // For now, implement only the product detection, ignore metadata
      // TODO: implement confidence level & version detection
      const splitPattern = pattern.split('\\;');
      return splitPattern[0];
    };

    ['implies', 'excludes'].forEach(prop => {
      if (!appObj[prop]) {
        return;
      }

      if (appObj[prop] instanceof Array) {
        newVendor[prop] = [...appObj[prop].map(parseWappalyzerLinkedVendor)];
      }
      else {
        newVendor[prop] = [parseWappalyzerLinkedVendor(appObj[prop])];
      }
    });

    ['url', 'html', 'script'].forEach(prop => {
      if (!appObj[prop]) {
        return;
      }

      const newProp = prop + 'Rules';
      if (appObj[prop] instanceof Array) {
        newVendor[newProp] = [...appObj[prop].map(parseWappalyzerPattern)];
      }
      else {
        newVendor[newProp] = [parseWappalyzerPattern(appObj[prop])];
      }
    });

    // headers
    let headers = appObj.headers;
    if (headers) {
      newVendor.headerRules = [];
      Object.keys(headers).forEach(header => {
        const rule: Vendor.HeaderRuleObject = {
          headerName: header,
          pattern: parseWappalyzerPattern(headers[header])
        };
        newVendor.headerRules.push(rule);
      });
    }

    // meta tags
    let meta = appObj.meta;
    if (meta) {
      newVendor.metaRules = [];
      Object.keys(meta).forEach(metaName => {
        const rule: Vendor.MetaRuleObject = {
          name: metaName,
          pattern: parseWappalyzerPattern(meta[metaName])
        };
        newVendor.metaRules.push(rule);
      });
    }

    return newVendor;
  }

  private loadYaml(pathToYaml: string): void {
    const vendorsObj = yaml.safeLoad(fs.readFileSync(pathToYaml).toString());
    if (!vendorsObj) {
      return;
    }

    const vendorNames = Object.keys(vendorsObj);
    vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
  }

  private loadJs(pathToJs: string): void {
    const vendorsObj = require(pathToJs);
    const vendorNames = Object.keys(vendorsObj);
    vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
  }

  private mergeVendor(vendorName: string, newVendorObj: Vendor.Vendor): void {
    if (!newVendorObj || typeof newVendorObj !== 'object') {
      return;
    }

    const existingVendorObj = this.vendors.get(vendorName);

    if (!existingVendorObj) {
      this.vendors.set(vendorName, this.prepareVendor(vendorName, newVendorObj));
      return;
    }

    const props = Object.keys(newVendorObj);
    props.forEach(prop => {
      const existingValue = existingVendorObj[prop];
      const newValue = newVendorObj[prop];
      if (existingValue instanceof Array && newValue instanceof Array) {
        newValue.forEach(item => existingValue.push(item));
      }
      else if (typeof existingValue === 'object') {
        Object.assign(existingValue, newValue);
      }
    });
  }

  private prepareVendor(vendorName: string, vendorObj: Vendor.Vendor): Vendor.Vendor {
    const preparedVendor: Vendor.Vendor = {
      baseResult: {},
      hostnameRules: [],
      urlRules: [],
      ipRangeRules: [],
      headerRules: [],
      dnsRules: [],
      metaRules: [],
      htmlRules: [],
      scriptRules: [],
      ...vendorObj
    };

    if (!preparedVendor.baseResult.vendor) {
      preparedVendor.baseResult.vendor = vendorName;
    }

    return preparedVendor;
  }

  private resolveVendorsRecursive(vendorName: string, property: string, alreadyTraversed: any): string[] {
    alreadyTraversed[vendorName] = true;

    if (!this.vendors.get(vendorName)) {
      // If you're using ASN or others, the vendor isn't indexed
      return [];
    }

    let resolvedVendors = this.vendors.get(vendorName)[property];
    if (resolvedVendors) {
      resolvedVendors.forEach(resolvedVendor => {
        if (alreadyTraversed[resolvedVendor]) {
          return;
        }

        resolvedVendors = resolvedVendors.concat(this.resolveVendorsRecursive(resolvedVendor, property, alreadyTraversed));
        alreadyTraversed[resolvedVendor] = true;
      });

      return resolvedVendors;
    }

    return [];
  }

  private loadImplicationsAndExclusions(): void {
    for (let vendorName of this.vendors.keys()) {
      this.vendorImplications.set(vendorName, this.resolveVendorsRecursive(vendorName, 'implies', {}));
      this.vendorExclusions.set(vendorName, this.resolveVendorsRecursive(vendorName, 'excludes', {}));
    }
  }

  private applyImplicationsAndExclusions(results: Vendor.DetectionResult[]): Vendor.DetectionResult[] {
    // results should be scoped to a single URL or hostname
    // To be filled with vendor names listed in the results
    const vendorNames = new Set<string>();

    // Apply implications
    const impliedResults: Vendor.DetectionResult[] = [];

    results.forEach(result => {
      vendorNames.add(result.vendor);
      const vendorObj = this.vendors.get(result.vendor);
      const impliedVendors = this.vendorImplications.get(result.vendor);

      if (!impliedVendors) {
        return;
      }

      impliedVendors.forEach(impliedVendor => {
        vendorNames.add(impliedVendor);

        // Add results for each implied vendor
        impliedResults.push({
          ...result,
          vendor: impliedVendor
        });
      });
    });

    impliedResults.forEach(result => results.push(result));

    // Apply exclusions
    const vendorsToRemove = new Set<string>();
    vendorNames.forEach(vendorName => {
      const exclusions = this.vendorExclusions.get(vendorName);
      if (!exclusions) {
        return;
      }

      exclusions.forEach(v => vendorsToRemove.add(v));
    });

    results = results.filter(result => !vendorsToRemove.has(result.vendor));

    return results;
  }

  async applyOuterRules(targetUrls: string[], resolver: Resolver): Promise<Vendor.DetectionResult[]> {
    let results: Vendor.DetectionResult[] = [];

    const resultPromises = targetUrls.map(target => this.applyOuterRulesUrl(target, resolver));
    const resultsArraysOfArrays = await Promise.all(resultPromises);
    resultsArraysOfArrays.forEach(part => results = results.concat(...part));

    return results;
  }

  async applyOuterRulesUrl(targetUrl: string, resolver: Resolver): Promise<Vendor.DetectionResult[]> {
    let results: Vendor.DetectionResult[] = [];
    const hostname = url.parse(targetUrl).hostname.toLowerCase();

    const addResult = (rule: Vendor.VendorRuleObject) => {
      results.push({
        hostname,
        url: targetUrl,
        ...rule.result,
        rule
      });
    };

    const addResultDns = (rule: Vendor.VendorRuleObject) => {
      results.push({
        hostname,
        ...rule.result,
        rule
      });
    };

    this.hostnameRules.forEach(rule => {
      if (matchPattern(hostname, rule.pattern)) {
        addResultDns(rule);
      }
    });

    this.urlRules.forEach(rule => {
      if (matchPattern(targetUrl, rule.pattern)) {
        addResult(rule);
      }
    });

    let dnsResults = await resolver.resolveDns(hostname);
    dnsResults.forEach(dnsResult => {
      if (dnsResult.dnsRecordType === 'A') {
        this.ipRangeRules.forEach(rule => {
          const ipAsLong = ip2long(dnsResult.dnsRecordValue);
          if (ipAsLong >= rule.first && ipAsLong <= rule.last) {
            addResultDns(rule);
          }
        });
      }
      else {
        this.dnsRules.forEach(rule => {
          if (rule.recordType === dnsResult.dnsRecordType &&
              matchPattern(dnsResult.dnsRecordValue, rule.pattern)) {
            addResultDns(rule);
          }
        });
      }
    });

    // Headers
    let headerResults = await resolver.resolveHeaders(targetUrl);

    headerResults.forEach(headerResult => {
      this.headerRules.forEach(rule => {
        if (rule.headerName.toLowerCase() === headerResult.headerName.toLowerCase() &&
            matchPattern(headerResult.headerValue, rule.pattern)) {
          addResult(rule);
        }
      });
    });

    results = this.applyImplicationsAndExclusions(results);

    return results;
  }

  async applyInnerRules(targetUrls: string[], resolver: Resolver): Promise<Vendor.DetectionResult[]> {
    let results: Vendor.DetectionResult[] = [];

    const resultPromises = targetUrls.map(target => this.applyInnerRulesUrl(target, resolver));
    const resultsArraysOfArrays = await Promise.all(resultPromises);
    resultsArraysOfArrays.forEach(part => results = results.concat(...part));

    return results;
  }

  async applyInnerRulesUrl(targetUrl: string, resolver: Resolver): Promise<Vendor.DetectionResult[]> {
    let results: Vendor.DetectionResult[] = [];

    const hostname = url.parse(targetUrl).hostname.toLowerCase();

    const addResult = (rule: Vendor.VendorRuleObject) => {
      results.push({
        hostname,
        url: targetUrl,
        ...rule.result,
        rule
      });
    };

    const htmlResults = await resolver.resolveHtml(targetUrl);
    htmlResults.forEach(htmlResult => {
      if (htmlResult.responseText) {
        const responseText = htmlResult.responseText;
        this.htmlRules.forEach(rule => {
          if (matchPattern(responseText, rule.pattern)) {
            addResult(rule);
          }
        });
      }
      else if (htmlResult.metaName) {
        this.metaRules.forEach(rule => {
          if (rule.name.toLowerCase() === htmlResult.metaName.toLowerCase() &&
              matchPattern(htmlResult.metaValue, rule.pattern)) {
            addResult(rule);
          }
        });
      }
      else if (htmlResult.scriptSrc) {
        this.scriptRules.forEach(rule => {
          if (matchPattern(htmlResult.scriptSrc, rule.pattern)) {
            addResult(rule);
          }
        });
      }
    });

    results = this.applyImplicationsAndExclusions(results);

    return results;
  }
}

function matchPattern(value: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return !!value.match(pattern);
  }
  else if (pattern instanceof RegExp) {
    return !!pattern.exec(value);
  }
}

function canonizeSingularRule(rule: any) {
  if (typeof rule === 'string' || rule instanceof RegExp) {
    return { pattern: rule };
  }

  return rule;
}

export const VendorRuleCanonizers = {
  hostnameRules(rule: any): Vendor.VendorRuleObject {
    return canonizeSingularRule(rule);
  },

  urlRules(rule: any): Vendor.VendorRuleObject {
    return canonizeSingularRule(rule);
  },

  ipRangeRules(rule: any): Vendor.IpRangeRule {
    if (rule.ipRange) {
      const netmask = new Netmask(rule.ipRange);
      return {
        first: ip2long(netmask.first),
        last: ip2long(netmask.last),
        ...rule
      };
    }

    return rule;
  },

  headerRules(rule: any): Vendor.HeaderRuleObject {
    const keys = Object.keys(rule);
    if (keys.length === 1) {
      return {
        headerName: keys[0],
        pattern: new RegExp(rule[keys[0]])
      };
    }

    return rule;
  },

  dnsRules(rule: any): Vendor.DnsRuleObject {
    if (rule.recordType && rule.pattern) {
      return rule;
    }

    let recordType: string;
    let pattern: RegExp;
    const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME', 'SOA', 'NAPTR'];
    const possibleProps = recordTypes.map(t => t.toLowerCase());
    const found = possibleProps.some(prop => {
      if (rule[prop]) {
        recordType = prop.toUpperCase();
        pattern = new RegExp(rule[prop]);
        return true;
      }

      return false;
    });

    if (found) {
      return { recordType: recordType, pattern };
    }

    return rule;
  },

  metaRules(rule: any): Vendor.MetaRuleObject {
    const keys = Object.keys(rule);
    if (keys.length === 1) {
      return {
        name: keys[0],
        pattern: new RegExp(rule[keys[0]])
      };
    }

    return rule;
  },

  htmlRules(rule: any): Vendor.VendorRuleObject {
    return canonizeSingularRule(rule);
  },

  // TODO
  scriptRules(rule: any): Vendor.ScriptRule {
    return canonizeSingularRule(rule);
  }
};
