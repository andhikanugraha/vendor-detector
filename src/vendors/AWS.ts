import { BaseVendor, IpRange } from '../BaseVendor';
import fetch from 'node-fetch';

interface AwsIpPrefix {
  ip_prefix: string;
  region: string;
  service: string;
}

const AmazonS3 = {
  product: 'S3',
  productCategories: ['storage']
};

const CloudFront = {
  product: 'CloudFront',
  productCategories: ['cdn']
}

export class AWS extends BaseVendor  {
  hostnameDetectionRules = [/.amazonaws.com$/];
  headerDetectionRules = [
    {
      header: 'Server',
      match: 'AmazonS3',
      result: AmazonS3
    },
    {
      header: 'Via',
      match: 'CloudFront',
      result: CloudFront
    }
  ];

  static readonly ipRangesEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
  static ipRanges: IpRange[] = [];

  static async init(): Promise<void> {
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
