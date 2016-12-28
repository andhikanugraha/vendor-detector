// FetchPool
// Only do a single fetch per target and enforce concurrency controls using a queue
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
const PQueue = require("p-queue");
const node_fetch_1 = require("node-fetch");
class FetchPool {
    constructor(options = {}) {
        this.pool = new Map();
        if (options.defaultUserAgent) {
            this.defaultUserAgent = options.defaultUserAgent;
        }
        this.queue = new PQueue({ concurrency: options.concurrency });
    }
    fetch(url, options = { headers: {} }) {
        let poolKey = JSON.stringify({ url, options });
        if (this.pool.get(poolKey)) {
            return this.pool.get(poolKey);
        }
        options = __assign({}, options, { headers: __assign({ 'User-Agent': this.defaultUserAgent }, options.headers) });
        const fetchPromise = this.queue.add(() => node_fetch_1.default(url, options));
        this.pool.set(poolKey, fetchPromise);
        return fetchPromise;
    }
}
exports.FetchPool = FetchPool;
