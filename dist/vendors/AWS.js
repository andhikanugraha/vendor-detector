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
const AmazonS3 = {
    product: 'S3',
    productCategories: ['storage']
};
const CloudFront = {
    product: 'CloudFront',
    productCategories: ['cdn']
};
class AWS extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.hostnameDetectionRules = [/.amazonaws.com$/];
        this.headerDetectionRules = [
            {
                header: 'Server',
                match: 'AmazonS3',
                result: AmazonS3
            },
            {
                header: 'Via',
                match: 'CloudFront',
                result: CloudFront
            }
        ];
    }
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch IP ranges
            const response = yield node_fetch_1.default(AWS.ipRangesEndpoint);
            const responseJson = yield response.json();
            AWS.ipRanges = responseJson.prefixes.map((prefix) => {
                return {
                    ipRange: prefix.ip_prefix,
                    region: prefix.region
                };
            });
        });
    }
}
AWS.ipRangesEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
AWS.ipRanges = [];
exports.AWS = AWS;
