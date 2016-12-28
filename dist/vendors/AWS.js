"use strict";
const tslib_1 = require("tslib");
const node_fetch_1 = require("node-fetch");
const awsIpRangeEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
exports.AWS = {
    baseResult: {
        vendor: 'Amazon Web Services'
    },
    hostnameRules: [/.amazonaws.com$/],
    load() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            console.log('Loading AWS IP Ranges...');
            const response = yield node_fetch_1.default(awsIpRangeEndpoint);
            const responseJson = yield response.json();
            const ipRangeRules = responseJson.prefixes.map((prefix) => {
                return {
                    ipRange: prefix.ip_prefix,
                    result: {
                        region: prefix.region
                    }
                };
            });
            return { ipRangeRules };
        });
    }
};
