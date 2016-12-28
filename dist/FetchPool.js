// FetchPool
// Only do a single fetch per target and enforce concurrency controls using a queue
"use strict";
const tslib_1 = require("tslib");
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
        options = tslib_1.__assign({}, options, { headers: tslib_1.__assign({ 'User-Agent': this.defaultUserAgent }, options.headers) });
        const fetchPromise = this.queue.add(() => node_fetch_1.default(url, options));
        this.pool.set(poolKey, fetchPromise);
        return fetchPromise;
    }
}
exports.FetchPool = FetchPool;
