import { Vendor, IpRangeRule } from '../Vendor';
import fetch from 'node-fetch';
import * as yauzl from 'yauzl';
import * as csvParser from 'csv-parser';

// Fetch from MaxMind's GeoLite database
const asnDbZipEndpoint = 'http://download.maxmind.com/download/geoip/database/asnum/GeoIPASNum2.zip';

export const ASN: Vendor = {

  async load(): Promise<Vendor> {
    console.log('Loading ASNumber database...');
    try {
      const catcher = e => { throw e; };
      // Fetch the download page
      const response = await fetch (asnDbZipEndpoint).catch(catcher);
      const responseBuffer = await response.buffer();

      const ipRangeRules: IpRangeRule[] = await new Promise<IpRangeRule[]>((resolve, reject) => {
        yauzl.fromBuffer(responseBuffer, { lazyEntries: true }, (err, zipfile) => {
          zipfile.readEntry();
          zipfile.once('entry', entry => {
            zipfile.openReadStream(entry, (err, readStream) => {
              const csvStream = csvParser(['first', 'last', 'vendor']);

              const ipRangeRules: IpRangeRule[] = [];
              readStream.pipe(csvStream).on('data', data => {
                const space = data.vendor.indexOf(' ');
                const asNumber = data.vendor.substr(0, space);
                const vendorName = data.vendor.substr(space + 1);

                const row: IpRangeRule = {
                  first: parseInt(data.first),
                  last: parseInt(data.last),
                  result: { vendor: vendorName, asNumber: asNumber }
                };
                ipRangeRules.push(row);
              }).on('end', () => {
                resolve(ipRangeRules);
              });
            });
          });
        });
      });

      return { ipRangeRules };
      // return {};
    }
    catch (e) {
      console.error(e);
      return null;
    }
  }
};
