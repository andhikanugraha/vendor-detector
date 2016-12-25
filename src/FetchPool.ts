// FetchPool
// Only do a single fetch per target and enforce concurrency controls using a queue

import * as PQueue from 'p-queue';
import * as fetchNS from 'node-fetch';
import fetch from 'node-fetch';

export interface FetchPoolOptions {
  defaultUserAgent?: string;
  concurrency?: Number;
}

export interface FetchResponse extends fetchNS.Response {}

export class FetchPool {
  queue: PQueue;
  pool = new Map<string, Promise<fetchNS.Response>>();

  defaultUserAgent: string;

  constructor(options: FetchPoolOptions) {
    if (options.defaultUserAgent) {
      this.defaultUserAgent = options.defaultUserAgent;
    }

    this.queue = new PQueue({ concurrency: options.concurrency });
  }

  fetch(url: string, options = { headers: {} }): Promise<FetchResponse> {
    let poolKey = JSON.stringify({url, options});

    if (this.pool.get(poolKey)) {
      return this.pool.get(poolKey);
    }

    options = {
      ...options,
      headers: {
        'User-Agent': this.defaultUserAgent,
        ...options.headers
      }
    };

    const fetchPromise = this.queue.add(() => fetch(url, options));
    this.pool.set(poolKey, fetchPromise);
    return fetchPromise;
  }
}
