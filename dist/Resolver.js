"use strict";
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
        return __awaiter(this, void 0, void 0, function* () {
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
        return __awaiter(this, void 0, void 0, function* () {
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
        return __awaiter(this, void 0, void 0, function* () {
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
}
exports.Resolver = Resolver;
