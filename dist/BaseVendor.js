"use strict";
const tslib_1 = require("tslib");
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
        return super.push(tslib_1.__assign({}, this.baseResult, result));
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const ctor = this.constructor; // the class inheriting this class
            if (!ctor.init) {
                return;
            }
            yield ctor.init((url, options) => tslib_1.__awaiter(this, void 0, void 0, function* () { return this.fetch(url, options); }));
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.results.setBaseResult(tslib_1.__assign({ vendor: this.constructor.name, productCategories: this.productCategories }, this.baseResult));
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const ctor = this.constructor;
            if (ctor.ipRanges) {
                this.ipRanges = ctor.ipRanges;
            }
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
                return { match: new RegExp(rule.endsWith.replace('.', '\\.') + '$'), result: rule.result };
            }
            return rule;
        });
        this.search.hostnames.forEach(hostname => {
            hostnameRules.forEach(rule => {
                if (this.matchHostname(hostname, rule.match)) {
                    console.dir(rule);
                    this.addResult(tslib_1.__assign({ hostname, certainty: 1 /* Definite */ }, rule.result));
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const fetchPromises = [];
            this.sampleUrls.forEach((sampleUrl, hostname) => {
                fetchPromises.push(this.applyHeaderDetectionRulesForUrl(hostname, sampleUrl));
            });
            yield Promise.all(fetchPromises).catch(e => { });
        });
    }
    applyHeaderDetectionRulesForUrl(sampleUrl, hostname) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetchHead(sampleUrl);
            if (!response || !response.headers) {
                // Request failed, no matter
                return;
            }
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
        return this.fetch(url, tslib_1.__assign({}, options, { method: 'HEAD' })).catch(e => { });
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
