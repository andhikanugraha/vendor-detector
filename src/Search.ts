import * as url from 'url';

import * as cheerio from 'cheerio';

import { FetchPool, FetchPoolOptions, FetchResponse } from './FetchPool';
import { VendorManager, VendorReference } from './VendorManager';

interface SearchOptions extends FetchPoolOptions {
  vendors?: VendorReference[]
}

export class Search {
  targetUrl: string;
  parsedTargetUrl: url.Url;
  responseText: string;
  $: CheerioStatic;

  fetchPool: FetchPool;
  vendorManager: VendorManager;

  hostnames = new Set<string>();
  urls = new Set<string>();
  urlsByHostname = new Map<string, Set<string>>();
  urlsByTag = new Map<string, Set<string>>();
  hostnamesByTag = new Map<string, Set<string>>();

  // How to use:
  // search = new Search('example.com');
  // results = await search.detectVendors();
  constructor(targetUrl: string, options: SearchOptions = {
    defaultUserAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36',
    concurrency: 1
  }) {
    this.targetUrl = targetUrl;
    this.parsedTargetUrl = url.parse(targetUrl);
    this.fetchPool = new FetchPool({
      defaultUserAgent: options.defaultUserAgent,
      concurrency: options.concurrency
    });
    this.vendorManager = new VendorManager(options.vendors);
  }

  // Populate this with the identified vendors and return this
  async detectVendors() {
    await this.scrapeUrls();
    const results = await this.analyzeUrls();

    return results;
  }

  async scrapeUrls() {
    const response = await this.fetch(this.targetUrl);
    const responseText = await response.text();
    const $ = this.$ = cheerio.load(responseText);

    // Get base href
    let baseUrl: string;

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
  }

  async analyzeUrls() {
    await this.vendorManager.init();
    return this.vendorManager.detect(this);
  }

  getHostname(urlString: string) {
    const parsedUrl = url.parse(urlString);
    return parsedUrl.hostname;
  }

  getAttributeValues(tag: string, attribute: string) {
    const $ = this.$;
    const selectorString = `${tag}[${attribute}]`;
    const elements = $(selectorString);
    const values: Array<string> = [];

    elements.map((idx, element) => {
      values.push($(element).attr(attribute));
    });

    return values;
  }

  addUrl(href: string, baseUrl?: string, tag?: string) {
    let urlString: string;
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
      this.urlsByHostname.set(hostname, new Set<string>());
    }
    this.urlsByHostname.get(hostname).add(urlString);

    if (!tag) {
      return;
    }

    if (!this.urlsByTag.has(tag)) {
      this.urlsByTag.set(tag, new Set<string>());
    }
    this.urlsByTag.get(tag).add(urlString);

    if (!this.hostnamesByTag.has(tag)) {
      this.hostnamesByTag.set(tag, new Set<string>());
    }
    this.hostnamesByTag.get(tag).add(hostname);
  }

  fetch(url: string, options = { headers: {} }): Promise<FetchResponse> {
    return this.fetchPool.fetch(url, options);
  }
}
