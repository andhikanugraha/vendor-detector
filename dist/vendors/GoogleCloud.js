"use strict";
const tslib_1 = require("tslib");
const dns = require("dns");
const pify = require("pify");
const dnsAsync = pify(dns);
const gcpIpRangeEndpoint = '_cloud-netblocks.googleusercontent.com';
exports.GCP = {
    baseResult: {
        vendor: 'Google Cloud Platform'
    },
    load() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            console.log('Loading GCP IP Ranges...');
            const blocklist = yield dnsAsync.resolveTxt(gcpIpRangeEndpoint);
            if (!blocklist) {
                return;
            }
            let allIpRanges = [];
            for (let record of blocklist) {
                let recordString = record.join();
                let netblocks = recordString.match(/(_cloud-netblocks[0-9]+\.googleusercontent.com)+/g);
                if (!netblocks) {
                    return;
                }
                for (let blockname of netblocks) {
                    let txt = yield dnsAsync.resolveTxt(blockname);
                    if (!txt) {
                        break;
                    }
                    let ipRanges = txt.join('').match(/([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2])) /g);
                    if (!ipRanges) {
                        break;
                    }
                    ipRanges = ipRanges.map(x => x.trim());
                    allIpRanges = allIpRanges.concat(...ipRanges);
                }
            }
            const ipRangeRules = allIpRanges.map(ipRange => {
                return { ipRange };
            });
            return { ipRangeRules };
        });
    }
};
