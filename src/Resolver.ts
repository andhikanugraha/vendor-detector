import * as dns from 'dns';
import * as pify from 'pify';

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
              dnsRecordValue: valueOf(record)
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
    const response = await fetch(targetUrl, { method: 'HEAD' });
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
}

export interface ResolverResult {
  hostname?: string;
  url?: string;
  ip4address?: string;
  dnsRecordType?: string;
  dnsRecordValue?: string;
  headerName?: string;
  headerValue?: string;
}
