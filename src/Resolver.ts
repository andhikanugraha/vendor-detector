import * as dns from 'dns';
import * as pify from 'pify';
import * as cheerio from 'cheerio';

import fetch from 'node-fetch';

import { FetchPool} from './FetchPool';

const dnsAsync = pify(dns);

// Resolve things like IP addresses, DNS records, headers, etc
// Preserve results in cache
export class Resolver {
  // private fetchPool: FetchPool;
  constructor() {
    // this.fetchPool = new FetchPool();
  }

  fetch(url: string, options: any = {}): Promise<any> {
    options = {
      timeout: 2000,
      ...options
    };

    return fetch(url, options).catch(e => { console.error(e); });
    // return this.fetchPool.fetch(url, options);
  }

  async resolveIp4(hostname: string): Promise<ResolverResult[]> {
    const addresses = await dnsAsync.resolve4(hostname);

    return addresses.map(addr => {
      const result: ResolverResult = {
        hostname,
        ip4address: addr
      };

      return result;
    });
  }

  async resolveDns(hostname: string): Promise<ResolverResult[]> {
    const results: ResolverResult[] = [];

    const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME', 'SOA', 'NAPTR'];
    const keys = {
      MX: x => x.exchange,
      TXT: x => x.join(''),
      SRV: x => x.name,
      SOA: x => x.nsname,
      NAPTR: x => x.replacement
    };

    for (let recordType of recordTypes) {
      const records = await dnsAsync.resolve(hostname, recordType).catch(e => {});
      if (records) {
        const valueOf = keys[recordType] || (x => x);

        if (records instanceof Array) {
          records.forEach(record => {
            const result: ResolverResult = {
              hostname,
              dnsRecordType: recordType,
              dnsRecordValue: valueOf(record).toLowerCase()
            };

            results.push(result);
          });
        }
        else {
          results.push({
            hostname,
            dnsRecordType: recordType,
            dnsRecordValue: valueOf(records)
          });
        }
      }
    }

    return results;
  }

  async resolveHeaders(targetUrl: string): Promise<ResolverResult[]> {
    const results = [];
    const response = await this.fetch(targetUrl, { method: 'HEAD' });
    if (!response) {
      return [];
    }
    const headers = response.headers;

    headers.forEach((value, name) => {
      const result: ResolverResult = {
        url: targetUrl,
        headerName: name.toLowerCase(),
        headerValue: value
      };
      results.push(result);
    });

    return results;
  }

  async resolveHtml(targetUrl: string): Promise<ResolverResult[]> {
    const results = [];
    const response = await this.fetch(targetUrl);
    if (!response) {
      return [];
    }

    const responseText = await response.text();

    results.push({
      targetUrl,
      responseText
    });

    const $ = cheerio.load(responseText);
    $('meta').each((i, metaElement) => {
      const name = $(metaElement).attr('name');
      const httpEquiv = $(metaElement).attr('http-equiv');
      const content = $(metaElement).attr('content');

      if (name) {
        results.push({
          targetUrl,
          metaName: name,
          metaValue: content
        });
      }
      else if (httpEquiv) {
        results.push({
          targetUrl,
          metaName: httpEquiv,
          metaValue: content
        });
      }
    });

    $('script').each((i, scriptElement) => {
      const scriptSrc = $(scriptElement).attr('src');

      results.push({
        targetUrl,
        scriptSrc
      });
    });

    return results;
  }
}

export interface ResolverResult {
  hostname?: string;
  url?: string;
  ip4address?: string;
  dnsRecordType?: string;
  dnsRecordValue?: string;
  headerName?: string;
  headerValue?: string;
  metaName?: string;
  metaValue?: string;
  scriptSrc?: string;
  responseText?: string;
}
