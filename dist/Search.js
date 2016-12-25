"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const url = require("url");
const cheerio = require("cheerio");
const FetchPool_1 = require("./FetchPool");
const VendorManager_1 = require("./VendorManager");
class Search {
    // How to use:
    // search = new Search('example.com');
    // results = await search.detectVendors();
    constructor(targetUrl, options = {
            defaultUserAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36',
            concurrency: 1
        }) {
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
        this.vendorManager = new VendorManager_1.VendorManager(options.vendors);
    }
    // Populate this with the identified vendors and return this
    detectVendors() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.scrapeUrls();
            const results = yield this.analyzeUrls();
            return results;
        });
    }
    scrapeUrls() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch(this.targetUrl);
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
            this.addUrl(this.targetUrl);
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
        return __awaiter(this, void 0, void 0, function* () {
            yield this.vendorManager.init();
            return this.vendorManager.detect(this);
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
        return this.fetchPool.fetch(url, options);
    }
}
exports.Search = Search;
