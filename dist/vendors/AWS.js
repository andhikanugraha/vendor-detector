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
const awsIpRangeEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
exports.AWS = {
    hostnameRules: [/.amazonaws.com$/],
    load() {
        return __awaiter(this, void 0, void 0, function* () {
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
