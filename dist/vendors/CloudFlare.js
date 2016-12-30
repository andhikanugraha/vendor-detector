"use strict";
const tslib_1 = require("tslib");
const node_fetch_1 = require("node-fetch");
const ip4RangesEndpoint = 'https://www.cloudflare.com/ips-v4';
exports.CloudFlare = {
    load() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            console.log('Loading CloudFlare IP ranges...');
            try {
                const catcher = e => { throw e; };
                // Fetch the download page
                const response = yield node_fetch_1.default(ip4RangesEndpoint).catch(catcher);
                const responseText = yield response.text();
                const ipRanges = responseText.trim().split(/\s+/g);
                const ipRangeRules = ipRanges.map(range => {
                    return { ipRange: range };
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
