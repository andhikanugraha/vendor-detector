import { Vendor } from '../Vendor';
import * as dns from 'dns';
import * as pify from 'pify';
const dnsAsync = pify(dns);

const gcpIpRangeEndpoint = '_cloud-netblocks.googleusercontent.com';

export const GCP: Vendor = {
  baseResult: {
    vendor: 'Google Cloud Platform'
  },

  async load(): Promise<Vendor> {
    console.log('Loading GCP IP Ranges...');

    const blocklist = await dnsAsync.resolveTxt(gcpIpRangeEndpoint);
    if (!blocklist) {
      return;
    }

    let allIpRanges: string[] = [];
    for (let record of blocklist) {
      let recordString = record.join();
      let netblocks = recordString.match(/(_cloud-netblocks[0-9]+\.googleusercontent.com)+/g);
      if (!netblocks) {
        return;
      }
      for (let blockname of netblocks) {
        let txt = await dnsAsync.resolveTxt(blockname);
        if (!txt) {
          break;
        }

        let ipRanges = txt.join('').match(/([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2])) /g);
        if (!ipRanges) {
          break;
        }
        ipRanges = ipRanges.map(x => x.trim());

        allIpRanges = allIpRanges.concat(...ipRanges);
      }
    }

    const ipRangeRules = allIpRanges.map(ipRange => {
      return { ipRange };
    });

    return {ipRangeRules};
  }
};
