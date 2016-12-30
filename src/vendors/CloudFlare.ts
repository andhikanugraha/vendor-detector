import { Vendor } from '../Vendor';
import fetch from 'node-fetch';

const ip4RangesEndpoint = 'https://www.cloudflare.com/ips-v4';

export const CloudFlare: Vendor = {

  async load(): Promise<Vendor> {
    console.log('Loading CloudFlare IP ranges...');
    try {
      const catcher = e => { throw e; };
      // Fetch the download page
      const response = await fetch (ip4RangesEndpoint).catch(catcher);
      const responseText = await response.text();
      const ipRanges = responseText.trim().split(/\s+/g);

      const ipRangeRules = ipRanges.map(range => {
        return { ipRange: range };
      });

      return { ipRangeRules };
    }
    catch (e) {
      console.error(e);
      return null;
    }
  }
};
