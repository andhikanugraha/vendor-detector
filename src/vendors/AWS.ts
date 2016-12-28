import { Vendor } from '../Vendor';
import fetch from 'node-fetch';

interface AwsIpPrefix {
  ip_prefix: string;
  region: string;
  service: string;
}

const awsIpRangeEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';

export const AWS: Vendor = {
  baseResult: {
    vendor: 'Amazon Web Services'
  },
  hostnameRules: [/.amazonaws.com$/],

  async load(): Promise<Vendor> {
    console.log('Loading AWS IP Ranges...');
    const response = await fetch(awsIpRangeEndpoint);
    const responseJson = await response.json();
    const ipRangeRules = responseJson.prefixes.map((prefix: AwsIpPrefix) => {
      return {
        ipRange: prefix.ip_prefix,
        result: {
          region: prefix.region
        }
      };
    });

    return {ipRangeRules};
  }
};
