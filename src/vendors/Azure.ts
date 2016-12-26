import { BaseVendor, IpRange } from '../BaseVendor';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export class Azure extends BaseVendor  {
  hostnameDetectionRules = [
    {
      match: /.core.windows.net$/,
      result: {
        product: 'Storage',
        productCategories: ['storage']
      }
    },
    {
      match: /.cloudapp.azure.com$/,
      result: {
        product: 'Virtual Machines',
        productCategories: ['compute']
      }
    },
    {
      match: /.azurewebsites.net$/,
      result: {
        product: 'App Service',
        productCategories: ['appPaaS', 'compute', 'web']
      }
    },
    {
      match: /.azureedge.net$/,
      result: {
        product: 'CDN',
        productCategories: ['cdn']
      }
    },
    {
      match: /.msecnd.net$/,
      result: {
        product: 'CDN',
        productCategories: ['cdn']
      }
    },
    {
      match: /.cloudapp.net$/,
      result: {
        product: 'Virtual Machines or Web/Worker Roles',
        productCategories: ['compute']
      }
    }
  ];

  static readonly ipRangesDownloadPage = 'https://www.microsoft.com/en-us/download/confirmation.aspx?id=41653';
  static ipRanges: IpRange[] = [];

  static async init(): Promise<void> {
    try {
      const catcher = e => { throw e; };
      // Fetch the download page
      const downloadPageResponse = await fetch (Azure.ipRangesDownloadPage).catch(catcher);

      const downloadPageText = await downloadPageResponse.text();
      const downloadPage$ = cheerio.load(downloadPageText);

      const xmlUrl = downloadPage$('div.start-download a').attr('href');

      if (!xmlUrl) {
        throw new Error('XML file not found in download page.');
      }

      const xmlResponse = await fetch(xmlUrl).catch(catcher);

      const xmlText = await xmlResponse.text();
      const xml$ = cheerio.load(xmlText);

      Azure.ipRanges = [];

      xml$('Region').each((idx, RegionElement) => {
        const region = xml$(RegionElement).attr('name');
        xml$('IpRange', RegionElement).each((idx, IpRangeElement) => {
          const ipRange = xml$(IpRangeElement).attr('subnet');
          Azure.ipRanges.push({ ipRange, region });
        });
      });
    }
    catch (e) {
      console.error(e);
      return;
    }
  }
}
