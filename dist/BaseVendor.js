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
const pify = require("pify");
const netmask_1 = require("netmask");
const dnsAsync = pify(dns);
class DetectionResultSet extends Array {
    constructor(baseResult) {
        super();
        if (baseResult) {
            this.setBaseResult(baseResult);
        }
    }
    setBaseResult(baseResult) {
        this.baseResult = baseResult;
    }
    push(result) {
        return super.push(__assign({}, this.baseResult, result));
    }
}
exports.DetectionResultSet = DetectionResultSet;
class BaseVendor {
    constructor(search) {
        this.results = new DetectionResultSet();
        this.baseResult = {};
        this.headerDetectionRules = [];
        this.hostnameDetectionRules = [];
        this.sampleUrls = new Map();
        this.intermediateByHostname = new Map();
        this.ipRanges = [];
        this.search = search;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const ctor = this.constructor; // the class inheriting this class
            if (!ctor.init) {
                return;
            }
            yield ctor.init((url, options) => __awaiter(this, void 0, void 0, function* () { return this.fetch(url, options); }));
            if (ctor.ipRanges) {
                this.ipRanges = ctor.ipRanges.map(range => {
                    if (range.ipRange) {
                        range.netmask = new netmask_1.Netmask(range.ipRange);
                    }
                    return range;
                });
            }
        });
    }
    detect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.results.setBaseResult(__assign({ vendor: this.constructor.name, productCategories: this.productCategories }, this.baseResult));
            this.expandHeaderDetectionRuleShorthand();
            this.populateSampleUrls();
            this.applyHostnameDetectionRules();
            yield this.detectByIpv4Addresses();
            yield this.applyHeaderDetectionRules();
            return this.results;
        });
    }
    populateSampleUrls() {
        const rules = this.headerDetectionRules;
        let addedAll = false;
        let addedOne = false;
        let addedHttps = false;
        let addedHttp = false;
        // Added url samples
        rules.forEach((rule) => {
            const sampling = rule.urlSampling || 0 /* One */;
            if (sampling === 1 /* All */ && !addedAll) {
                this.search.urlsByHostname.forEach((urls, hostname) => {
                    urls.forEach(sampleUrl => this.sampleUrls.set(sampleUrl, hostname));
                });
                addedAll = true;
            }
            else if (!addedAll && !addedOne) {
                this.search.urlsByHostname.forEach((urls, hostname) => {
                    const sampleUrl = urls.values().next().value;
                    this.sampleUrls.set(sampleUrl, hostname);
                });
                addedOne = true;
            }
            if (sampling === 3 /* RootHttps */ && !addedHttps) {
                this.search.hostnames.forEach(host => {
                    const sampleUrl = 'https://' + host;
                    this.sampleUrls.set(sampleUrl, host);
                });
                addedHttps = true;
            }
            if (sampling === 2 /* RootHttp */ && !addedHttp) {
                this.search.hostnames.forEach(host => {
                    const sampleUrl = 'http://' + host;
                    this.sampleUrls.set(sampleUrl, host);
                });
                addedHttp = true;
            }
        });
    }
    detectByIpv4Addresses() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ipRanges.length === 0 || this.search.resolvedHostnames.length === 0) {
                return;
            }
            const resolvedHostnames = this.search.resolvedHostnames;
            let resolvedHostnameCursor = 0;
            let ipRangeCursor = 0;
            while (resolvedHostnameCursor < resolvedHostnames.length &&
                ipRangeCursor < this.ipRanges.length) {
                const currentResolvedHostname = resolvedHostnames[resolvedHostnameCursor];
                const currentIpRange = this.ipRanges[ipRangeCursor];
                const [hostname, addr] = currentResolvedHostname;
                const found = currentIpRange.netmask.contains(addr);
                if (found) {
                    this.addResult({
                        certainty: 1 /* Definite */,
                        hostname,
                        region: currentIpRange.region,
                        ipAddress: addr,
                        ipRange: currentIpRange.ipRange
                    });
                    resolvedHostnameCursor++;
                }
                else {
                    ipRangeCursor++;
                }
            }
        });
    }
    applyHostnameDetectionRules() {
        const hostnameRules = 
        // Expand shorthand syntax for header rules
        this.hostnameDetectionRules.map((rule) => {
            if (rule instanceof RegExp) {
                return { match: rule, result: {} };
            }
            else if (rule.endsWith) {
                return { match: new RegExp(rule.endsWith.replace('.', '\\.') + '$'), result: {} };
            }
            return rule;
        });
        this.search.hostnames.forEach(hostname => {
            hostnameRules.forEach(rule => {
                if (this.matchHostname(hostname, rule.match)) {
                    this.addResult(__assign({ hostname, certainty: 1 /* Definite */ }, rule.result));
                }
            });
        });
    }
    matchHostname(hostname, match) {
        if (typeof match === 'string') {
            return !!hostname.match(match);
        }
        else {
            return !!match.exec(hostname);
        }
    }
    expandHeaderDetectionRuleShorthand() {
        // Expand shorthand syntax for header rules
        this.headerDetectionRules.forEach((rule, idx) => {
            if (Object.keys(rule).length === 1) {
                const header = Object.keys(rule)[0];
                const match = rule[header];
                this.headerDetectionRules[idx] = { header, match };
            }
        });
    }
    applyHeaderDetectionRules() {
        return __awaiter(this, void 0, void 0, function* () {
            const fetchPromises = [];
            this.sampleUrls.forEach((sampleUrl, hostname) => {
                fetchPromises.push(this.applyHeaderDetectionRulesForUrl(hostname, sampleUrl));
            });
            yield Promise.all(fetchPromises).catch(e => { throw e; });
        });
    }
    applyHeaderDetectionRulesForUrl(sampleUrl, hostname) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetchHead(sampleUrl);
            const headers = response.headers;
            this.headerDetectionRules.forEach((rule) => {
                if (this.matchHeader(headers, rule.header, rule.match)) {
                    const result = { certainty: 1 /* Definite */, hostname };
                    if (rule.urlSampling === 1 /* All */) {
                        result.url = sampleUrl;
                    }
                    Object.assign(result, rule.result);
                    this.addResult(result);
                }
            });
        });
    }
    addResult(result) {
        this.results.push(result);
    }
    fetch(url, options) {
        return this.search.fetch(url, options);
    }
    fetchHead(url, options) {
        return this.fetch(url, __assign({}, options, { method: 'HEAD' }));
    }
    matchHeader(headersObject, header, needle) {
        header = header.toLowerCase();
        if (!headersObject.has(header)) {
            return false;
        }
        if (typeof needle === 'string') {
            return !!headersObject.get(header).match(needle);
        }
        return !!needle.exec(headersObject.get(header));
    }
}
exports.BaseVendor = BaseVendor;
