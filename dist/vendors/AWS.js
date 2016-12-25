"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const dns = require("dns");
const node_fetch_1 = require("node-fetch");
const pify = require("pify");
const netmask_1 = require("netmask");
const dnsAsync = pify(dns);
class AWS {
    constructor() {
        this.ipRangesEndpoint = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
        this.ipRanges = [];
        this.baseResult = {
            type: 'definite',
            vendor: 'aws',
            products: []
        };
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch IP ranges
            const response = yield node_fetch_1.default(this.ipRangesEndpoint);
            const responseJson = yield response.json();
            this.ipRanges = responseJson.prefixes.map((prefix) => {
                prefix.netmask = new netmask_1.Netmask(prefix.ip_prefix);
                return prefix;
            });
        });
    }
    detect(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            const hostnames = Array.from(search.hostnames);
            const undetectedHostnames = [...hostnames];
            const detectionByHostname = new Map();
            yield this.resolveIpv4AndDetect(undetectedHostnames, detectionByHostname);
            yield this.detectByReponseHeaders(search, hostnames, detectionByHostname);
            detectionByHostname.forEach((result, hostname) => {
                console.log(result);
                if (result.products.length > 0) {
                    result.products.forEach(product => {
                        const subResult = __assign({}, result, { product });
                        delete subResult.products;
                        results.push(subResult);
                    });
                }
                else {
                    const subResult = __assign({}, result);
                    delete subResult.products;
                    results.push(subResult);
                }
            });
            return results;
        });
    }
    resolveIpv4AndDetect(undetectedHostnames, detectionByHostname) {
        return __awaiter(this, void 0, void 0, function* () {
            const resolvedHostnames = [];
            const indexesToRemove = [];
            for (let hostname of undetectedHostnames) {
                let ipv4addr = yield dnsAsync.resolve4(hostname);
                ipv4addr.forEach(addr => resolvedHostnames.push([hostname, addr]));
            }
            let resolvedHostnameCursor = 0;
            let ipRangeCursor = 0;
            while (resolvedHostnameCursor < resolvedHostnames.length &&
                ipRangeCursor < this.ipRanges.length) {
                const currentResolvedHostname = resolvedHostnames[resolvedHostnameCursor];
                const currentIpRange = this.ipRanges[ipRangeCursor];
                const [hostname, ip4addr] = currentResolvedHostname;
                const found = currentIpRange.netmask.contains(ip4addr);
                if (found) {
                    detectionByHostname.set(hostname, __assign({}, this.baseResult, { hostname, region: currentIpRange.region, ipRange: currentIpRange.ip_prefix }));
                    indexesToRemove.push(resolvedHostnameCursor);
                    resolvedHostnameCursor++;
                }
                else {
                    ipRangeCursor++;
                }
            }
            indexesToRemove.forEach(index => undetectedHostnames.splice(index));
        });
    }
    detectByReponseHeaders(search, hostnames, detectionByHostname) {
        return __awaiter(this, void 0, void 0, function* () {
            const detectPromises = hostnames.map(hostname => this.detectHostnameByReponseHeaders(search, hostname, detectionByHostname));
            yield Promise.all(detectPromises);
        });
    }
    detectHostnameByReponseHeaders(search, hostname, detectionByHostname) {
        return __awaiter(this, void 0, void 0, function* () {
            const products = [];
            const sampleUrl = search.urlsByHostname.get(hostname).values().next().value;
            const response = yield this.fetchHead(search, sampleUrl);
            const headers = response.headers;
            if (this.matchHeader(headers, 'Server', 'AmazonS3')) {
                products.push('S3');
            }
            if (this.matchHeader(headers, 'Server', 'AmazonS3')) {
                products.push('CloudFront');
            }
            if (detectionByHostname.get(hostname)) {
                const preresult = detectionByHostname.get(hostname);
                preresult.products = preresult.products.concat(products);
            }
            else if (products.length > 0) {
                detectionByHostname.set(hostname, __assign({}, this.baseResult, { hostname,
                    products }));
            }
        });
    }
    matchHeader(headersObject, header, needle) {
        header = header.toLowerCase();
        const headerValue = headersObject.get(header);
        if (!headerValue) {
            return false;
        }
        if (typeof headerValue === 'string') {
            return headerValue.match(needle);
        }
        if (headerValue instanceof Array) {
            return headerValue.some(value => value.match(needle));
        }
    }
    fetchHead(search, url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return search.fetch(url, __assign({}, options, { method: 'HEAD' }));
        });
    }
}
exports.AWS = AWS;
