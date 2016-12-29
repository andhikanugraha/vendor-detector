import { Vendor } from '../Vendor';
import fetch from 'node-fetch';

const ip4RangesEndpoint = 'http://knowledgelayer.softlayer.com/faq/what-ip-ranges-do-i-allow-through-firewall';

export const Bluemix: Vendor = {

  async load(): Promise<Vendor> {
    console.log('Loading Bluemix/Softlayer IP ranges...');
    try {
      const catcher = e => { throw e; };
      // Fetch the download page
      const response = await fetch (ip4RangesEndpoint).catch(catcher);
      const responseText = await response.text();
      const ipRanges = responseText.trim().match(/([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]{1,2}))/g);

      return ipRanges.map(range => {
        return { ipRange: range };
      });
    }
    catch (e) {
      console.error(e);
      return null;
    }
  }
};
