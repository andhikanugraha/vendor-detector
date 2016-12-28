import { Vendor } from '../Vendor';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const ipRangesDownloadPage = 'https://www.microsoft.com/en-us/download/confirmation.aspx?id=41653';

export const Azure: Vendor = {
  hostnameRules: [
    { pattern: /.core.windows.net$/,
      result: { vendor: 'Azure Storage' } },
    { pattern: /.cloudapp.azure.com$/,
      result: { vendor: 'Azure Virtual Machines (ARM)' } },
    { pattern: /.azurewebsites.net$/,
      result: { vendor: 'Azure App Service' } },
    { pattern: /.azureedge.net$/,
      result: { vendor: 'Azure CDN' } },
    { pattern: /.msecnd.net$/,
      result: { vendor: 'Azure CDN' } },
    { pattern: /.cloudapp.net$/,
      result: { vendor: 'Azure Virtual Machines (Classic) or Web/Worker Roles' } }
  ],

  async load(): Promise<Vendor> {
    console.log('Loading Azure IP ranges...');
    try {
      const catcher = e => { throw e; };
      // Fetch the download page
      const downloadPageResponse = await fetch (ipRangesDownloadPage).catch(catcher);

      const downloadPageText = await downloadPageResponse.text();
      const downloadPage$ = cheerio.load(downloadPageText);

      const xmlUrl = downloadPage$('div.start-download a').attr('href');

      if (!xmlUrl) {
        throw new Error('XML file not found in download page.');
      }

      const xmlResponse = await fetch(xmlUrl).catch(catcher);

      const xmlText = await xmlResponse.text();
      const xml$ = cheerio.load(xmlText);

      const ipRangeRules = [];

      xml$('Region').each((idx, RegionElement) => {
        const region = xml$(RegionElement).attr('name');
        xml$('IpRange', RegionElement).each((idx, IpRangeElement) => {
          const ipRange = xml$(IpRangeElement).attr('subnet');
          ipRangeRules.push({ ipRange, result: { region } });
        });
      });

      return { ipRangeRules };
    }
    catch (e) {
      console.error(e);
      return null;
    }
  }
};
