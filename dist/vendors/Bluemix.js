"use strict";
const tslib_1 = require("tslib");
const node_fetch_1 = require("node-fetch");
const ip4RangesEndpoint = 'http://knowledgelayer.softlayer.com/faq/what-ip-ranges-do-i-allow-through-firewall';
exports.Bluemix = {
    load() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            console.log('Loading Bluemix/Softlayer IP ranges...');
            try {
                const catcher = e => { throw e; };
                // Fetch the download page
                const response = yield node_fetch_1.default(ip4RangesEndpoint).catch(catcher);
                const responseText = yield response.text();
                const ipRanges = responseText.trim().match(/([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]{1,2}))/g);
                return ipRanges.map(range => {
                    return { ipRange: range };
                });
            }
            catch (e) {
                console.error(e);
                return null;
            }
        });
    }
};
