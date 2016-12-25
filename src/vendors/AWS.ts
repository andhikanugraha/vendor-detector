import { BaseVendor, UrlSampling, IpRange } from '../BaseVendor';
import fetch from 'node-fetch';

interface AwsIpPrefix {
  ip_prefix: string,
  region: string,
  service: string
}

export class AWS extends BaseVendor  {
  baseResult = {
    vendor: 'aws',
  };

  headerDetectionRules = [
    {
      header: 'Server',
      match: 'AmazonS3',
      result: { product: 'S3' }
    },
    {
      header: 'Via',
      match: 'CloudFront',
      result: { product: 'CloudFront' }
    }
  ];

  static readonly ipRangesEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
  static ipRanges: IpRange[] = [];

  static async init(fetch: (url: string, options?: any) => Promise<any>): Promise<void> {
    // Fetch IP ranges
    const response = await fetch(AWS.ipRangesEndpoint);
    const responseJson = await response.json();
    AWS.ipRanges = responseJson.prefixes.map((prefix: AwsIpPrefix): IpRange => {
      return {
        ipRange: prefix.ip_prefix,
        region: prefix.region
      };
    });
  }
}
