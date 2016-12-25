import * as dns from 'dns';

import { Vendor, DetectionResult } from '../VendorManager';
import { Search } from '../Search';
import fetch from 'node-fetch';
import * as pify from 'pify';
import { Netmask } from 'netmask';

const dnsAsync = pify(dns);

interface AwsIpRange {
  ip_prefix: string,
  region: string,
  service: string,
  netmask?: Netmask
}

interface AwsPreResult extends DetectionResult {
  products: string[]
}

export class AWS implements Vendor  {
  readonly ipRangesEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
  ipRanges: AwsIpRange[] = [];

  baseResult: AwsPreResult = {
    type: 'definite',
    vendor: 'aws',
    products: []
  };

  async init(): Promise<void> {
    // Fetch IP ranges
    const response = await fetch(this.ipRangesEndpoint);
    const responseJson = await response.json();
    this.ipRanges = responseJson.prefixes.map((prefix: AwsIpRange) => {
      prefix.netmask = new Netmask(prefix.ip_prefix);
      return prefix;
    });
  }

  async detect(search: Search): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    const hostnames = Array.from(search.hostnames);
    const undetectedHostnames = [...hostnames];

    const detectionByHostname = new Map<string, AwsPreResult>();
    await this.resolveIpv4AndDetect(undetectedHostnames, detectionByHostname);

    await this.detectByReponseHeaders(search, hostnames, detectionByHostname);

    detectionByHostname.forEach((result, hostname) => {

      console.log(result);
      if (result.products.length > 0) {
        result.products.forEach(product => {
          const subResult = {...result, product};
          delete subResult.products;
          results.push(subResult);
        });
      }
      else {
        const subResult = {...result};
        delete subResult.products;
        results.push(subResult);
      }
    })

    return results;
  }

  async resolveIpv4AndDetect(undetectedHostnames: string[], detectionByHostname: Map<string, AwsPreResult>) {
    const resolvedHostnames: [string, string][] = [];
    const indexesToRemove: number[] = [];

    for (let hostname of undetectedHostnames) {
      let ipv4addr: string[] = await dnsAsync.resolve4(hostname);
      ipv4addr.forEach(addr => resolvedHostnames.push([hostname, addr]));
    }

    let resolvedHostnameCursor = 0;
    let ipRangeCursor = 0;

    while (resolvedHostnameCursor < resolvedHostnames.length &&
           ipRangeCursor < this.ipRanges.length) {
      const currentResolvedHostname = resolvedHostnames[resolvedHostnameCursor];
      const currentIpRange = this.ipRanges[ipRangeCursor]
      const [hostname, ip4addr] = currentResolvedHostname;
      const found = currentIpRange.netmask.contains(ip4addr);

      if (found) {
        detectionByHostname.set(hostname, {
          ...this.baseResult,
          hostname,
          region: currentIpRange.region,
          ipRange: currentIpRange.ip_prefix
        });
        indexesToRemove.push(resolvedHostnameCursor);
        resolvedHostnameCursor++;
      }
      else {
        ipRangeCursor++;
      }
    }

    indexesToRemove.forEach(index => undetectedHostnames.splice(index));
  }

  async detectByReponseHeaders(search: Search, hostnames: string[], detectionByHostname: Map<string, AwsPreResult>) {
    const detectPromises = hostnames.map(hostname => this.detectHostnameByReponseHeaders(search, hostname, detectionByHostname ));
    await Promise.all(detectPromises);
  }

  async detectHostnameByReponseHeaders(search: Search, hostname: string, detectionByHostname: Map<string, AwsPreResult>): Promise<void> {
    const products: string[] = [];
    const sampleUrl = search.urlsByHostname.get(hostname).values().next().value;
    const response = await this.fetchHead(search, sampleUrl);
    const headers = response.headers;

    if (this.matchHeader(headers, 'Server', 'AmazonS3')) {
      products.push('S3');
    }

    if (this.matchHeader(headers, 'Server', 'AmazonS3')) {
      products.push('CloudFront');
    }

    if (detectionByHostname.get(hostname)) {
      const preresult = detectionByHostname.get(hostname);
      preresult.products = preresult.products.concat(products);
    }
    else if (products.length > 0) {
      detectionByHostname.set(hostname, {
        ...this.baseResult,
        hostname,
        products
      });
    }
  }

  matchHeader(headersObject: any, header: string, needle: string) {
    header = header.toLowerCase();
    const headerValue = headersObject.get(header);

    if (!headerValue) {
      return false;
    }
    if (typeof headerValue === 'string') {
      return headerValue.match(needle);
    }
    if (headerValue instanceof Array) {
      return headerValue.some(value => value.match(needle));
    }
  }

  async fetchHead(search: Search, url: string, options?: any) {
    return search.fetch(url, {
      ...options,
      method: 'HEAD'
    });
  }
}
