"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const node_fetch_1 = require("node-fetch");
const cheerio = require("cheerio");
const ipRangesDownloadPage = 'https://www.microsoft.com/en-us/download/confirmation.aspx?id=41653';
exports.Azure = {
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
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading Azure IP ranges...');
            try {
                const catcher = e => { throw e; };
                // Fetch the download page
                const downloadPageResponse = yield node_fetch_1.default(ipRangesDownloadPage).catch(catcher);
                const downloadPageText = yield downloadPageResponse.text();
                const downloadPage$ = cheerio.load(downloadPageText);
                const xmlUrl = downloadPage$('div.start-download a').attr('href');
                if (!xmlUrl) {
                    throw new Error('XML file not found in download page.');
                }
                const xmlResponse = yield node_fetch_1.default(xmlUrl).catch(catcher);
                const xmlText = yield xmlResponse.text();
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
        });
    }
};
