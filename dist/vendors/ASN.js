"use strict";
const tslib_1 = require("tslib");
const node_fetch_1 = require("node-fetch");
const yauzl = require("yauzl");
const csvParser = require("csv-parser");
// Fetch from MaxMind's GeoLite database
const asnDbZipEndpoint = 'http://download.maxmind.com/download/geoip/database/asnum/GeoIPASNum2.zip';
exports.ASN = {
    load() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            console.log('Loading ASNumber database...');
            try {
                const catcher = e => { throw e; };
                // Fetch the download page
                const response = yield node_fetch_1.default(asnDbZipEndpoint).catch(catcher);
                const responseBuffer = yield response.buffer();
                const ipRangeRules = yield new Promise((resolve, reject) => {
                    yauzl.fromBuffer(responseBuffer, { lazyEntries: true }, (err, zipfile) => {
                        zipfile.readEntry();
                        zipfile.once('entry', entry => {
                            zipfile.openReadStream(entry, (err, readStream) => {
                                const csvStream = csvParser(['first', 'last', 'vendor']);
                                const ipRangeRules = [];
                                readStream.pipe(csvStream).on('data', data => {
                                    const space = data.vendor.indexOf(' ');
                                    const asNumber = data.vendor.substr(0, space);
                                    const vendorName = data.vendor.substr(space + 1);
                                    const row = {
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
            }
            catch (e) {
                console.error(e);
                return null;
            }
        });
    }
};
