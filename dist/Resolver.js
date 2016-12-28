"use strict";
const tslib_1 = require("tslib");
const dns = require("dns");
const pify = require("pify");
const cheerio = require("cheerio");
const node_fetch_1 = require("node-fetch");
const dnsAsync = pify(dns);
// Resolve things like IP addresses, DNS records, headers, etc
// Preserve results in cache
class Resolver {
    // private fetchPool: FetchPool;
    constructor() {
        // this.fetchPool = new FetchPool();
    }
    resolveIp4(hostname) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const addresses = yield dnsAsync.resolve4(hostname);
            return addresses.map(addr => {
                const result = {
                    hostname,
                    ip4address: addr
                };
                return result;
            });
        });
    }
    resolveDns(hostname) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const results = [];
            const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME', 'SOA', 'NAPTR'];
            const keys = {
                MX: x => x.exchange,
                TXT: x => x.join(''),
                SRV: x => x.name,
                SOA: x => x.nsname,
                NAPTR: x => x.replacement
            };
            for (let recordType of recordTypes) {
                const records = yield dnsAsync.resolve(hostname, recordType).catch(e => { });
                if (records) {
                    const valueOf = keys[recordType] || (x => x);
                    if (records instanceof Array) {
                        records.forEach(record => {
                            const result = {
                                hostname,
                                dnsRecordType: recordType,
                                dnsRecordValue: valueOf(record)
                            };
                            results.push(result);
                        });
                    }
                    else {
                        results.push({
                            hostname,
                            dnsRecordType: recordType,
                            dnsRecordValue: valueOf(records)
                        });
                    }
                }
            }
            return results;
        });
    }
    resolveHeaders(targetUrl) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const results = [];
            const response = yield node_fetch_1.default(targetUrl, { method: 'HEAD' });
            const headers = response.headers;
            headers.forEach((value, name) => {
                const result = {
                    url: targetUrl,
                    headerName: name.toLowerCase(),
                    headerValue: value
                };
                results.push(result);
            });
            return results;
        });
    }
    resolveHtml(targetUrl) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const results = [];
            const response = yield node_fetch_1.default(targetUrl);
            const responseText = yield response.text();
            results.push({
                targetUrl,
                responseText
            });
            const $ = cheerio.load(responseText);
            $('meta').each((i, metaElement) => {
                const name = $(metaElement).attr('name');
                const httpEquiv = $(metaElement).attr('http-equiv');
                const content = $(metaElement).attr('content');
                if (name) {
                    results.push({
                        targetUrl,
                        metaName: name,
                        metaValue: content
                    });
                }
                else if (httpEquiv) {
                    results.push({
                        targetUrl,
                        metaName: httpEquiv,
                        metaValue: content
                    });
                }
            });
            $('script').each((i, scriptElement) => {
                const scriptSrc = $(scriptElement).attr('src');
                results.push({
                    targetUrl,
                    scriptSrc
                });
            });
            return results;
        });
    }
}
exports.Resolver = Resolver;
