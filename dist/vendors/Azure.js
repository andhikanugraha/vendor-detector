"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const BaseVendor_1 = require("../BaseVendor");
const node_fetch_1 = require("node-fetch");
const cheerio = require("cheerio");
class Azure extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.hostnameDetectionRules = [
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
    }
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const catcher = e => { throw e; };
                // Fetch the download page
                const downloadPageResponse = yield node_fetch_1.default(Azure.ipRangesDownloadPage).catch(catcher);
                const downloadPageText = yield downloadPageResponse.text();
                const downloadPage$ = cheerio.load(downloadPageText);
                const xmlUrl = downloadPage$('div.start-download a').attr('href');
                if (!xmlUrl) {
                    throw new Error('XML file not found in download page.');
                }
                const xmlResponse = yield node_fetch_1.default(xmlUrl).catch(catcher);
                const xmlText = yield xmlResponse.text();
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
        });
    }
}
Azure.ipRangesDownloadPage = 'https://www.microsoft.com/en-us/download/confirmation.aspx?id=41653';
Azure.ipRanges = [];
exports.Azure = Azure;
