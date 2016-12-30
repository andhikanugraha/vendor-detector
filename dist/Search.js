"use strict";
const tslib_1 = require("tslib");
const dns = require("dns");
const url = require("url");
const cheerio = require("cheerio");
const FetchPool_1 = require("./FetchPool");
const VendorManager_1 = require("./VendorManager");
const Resolver_1 = require("./Resolver");
const pify = require("pify");
const dnsAsync = pify(dns);
class Search {
    // How to use:
    // search = new Search('example.com');
    // results = await search.detectVendors();
    constructor(targetUrl, options = {
            defaultUserAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36',
            concurrency: 1
        }) {
        this.vendorManager = VendorManager_1.VendorManager.getInstance();
        this.resolver = new Resolver_1.Resolver;
        this.hostnames = new Set();
        this.urls = new Set();
        this.urlsByHostname = new Map();
        this.urlsByTag = new Map();
        this.hostnamesByTag = new Map();
        this.targetUrl = targetUrl;
        this.parsedTargetUrl = url.parse(targetUrl);
        this.fetchPool = new FetchPool_1.FetchPool({
            defaultUserAgent: options.defaultUserAgent,
            concurrency: options.concurrency
        });
    }
    // Populate this with the identified vendors and return this
    detectVendors() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.scrapeUrls();
            const results = yield this.analyzeUrls();
            return results;
        });
    }
    scrapeUrls() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.addUrl(this.targetUrl);
            const response = yield this.fetch(this.targetUrl, { timeout: 10000 }).catch(e => { });
            if (!response) {
                return;
            }
            const responseText = yield response.text();
            const $ = this.$ = cheerio.load(responseText);
            // Get base href
            let baseUrl;
            const baseHref = $('base').attr('href');
            if (baseHref) {
                baseUrl = url.resolve(this.targetUrl, baseHref);
            }
            else {
                baseUrl = this.targetUrl;
            }
            const tagsToScrape = [
                ['link', 'href'],
                ['img', 'src'],
                ['script', 'src']
            ];
            tagsToScrape.forEach(tagDef => {
                let [tag, attribute] = tagDef;
                this.getAttributeValues(tag, attribute).forEach(value => {
                    this.addUrl(value, baseUrl, tag);
                });
            });
        });
    }
    analyzeUrls() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                if (!Search.inited) {
                    yield this.vendorManager.init();
                    Search.inited = true;
                }
                const sampleUrls = [];
                this.urlsByHostname.forEach(setOfUrls => {
                    sampleUrls.push(setOfUrls.values().next().value);
                });
                const outerResults = yield this.vendorManager.applyOuterRules(sampleUrls, this.resolver);
                const innerResults = yield this.vendorManager.applyInnerRules([this.targetUrl], this.resolver);
                return [...outerResults, ...innerResults];
            }
            catch (e) {
                return [];
            }
        });
    }
    getHostname(urlString) {
        const parsedUrl = url.parse(urlString);
        return parsedUrl.hostname;
    }
    getAttributeValues(tag, attribute) {
        const $ = this.$;
        const selectorString = `${tag}[${attribute}]`;
        const elements = $(selectorString);
        const values = [];
        elements.map((idx, element) => {
            values.push($(element).attr(attribute));
        });
        return values;
    }
    addUrl(href, baseUrl, tag) {
        let urlString;
        if (baseUrl) {
            urlString = url.resolve(baseUrl, href);
        }
        else {
            urlString = href;
        }
        let parsedUrlString = url.parse(urlString);
        if (!parsedUrlString.protocol.match('http')) {
            return;
        }
        const hostname = this.getHostname(urlString);
        this.urls.add(urlString);
        this.hostnames.add(hostname);
        if (!this.urlsByHostname.has(hostname)) {
            this.urlsByHostname.set(hostname, new Set());
        }
        this.urlsByHostname.get(hostname).add(urlString);
        if (!tag) {
            return;
        }
        if (!this.urlsByTag.has(tag)) {
            this.urlsByTag.set(tag, new Set());
        }
        this.urlsByTag.get(tag).add(urlString);
        if (!this.hostnamesByTag.has(tag)) {
            this.hostnamesByTag.set(tag, new Set());
        }
        this.hostnamesByTag.get(tag).add(hostname);
    }
    fetch(url, options = { headers: {} }) {
        return this.fetchPool.fetch(url, options).catch(e => { throw e; });
    }
}
Search.inited = false;
exports.Search = Search;
function detectVendors(targetUrl, options) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const search = new Search(targetUrl, options);
        return search.detectVendors();
    });
}
exports.detectVendors = detectVendors;
