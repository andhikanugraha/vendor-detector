# vendor-detector

Detect _what_ and _how_ vendors are used by a site.

To use as a node module:

    npm install andhikanugraha/vendor-detector
  
    import { detectVendors } from 'vendor-detector'
    await detectVendors('http://example.com')

To run as a server (a [hosted version](https://vendordetector.azurewebsites.net/) is also available):

    git clone https://github.com/andhikanugraha/vendor-detector.git
    node dist/server

## Project objectives

* Not just _what_ vendors are used, but also _how_ they are being used and detected.
* Not just the site itself, but the resources it links to.
* Reuse whenever possible.
* It should be easy and flexible to add more vendors.

## How are vendors/products detected?

* Hostnames
* IP ranges
* DNS records
* HTTP headers
* HTML content
  * Meta tags
  * Script tags

This tool references [Wappalyzer's excellent apps.json](https://github.com/AliasIO/wappalyzer).

### To-do
- [x] Refactor vendor definitions
- [x] Maintain compatibility & absorb rules with wappalyzer
- [x] Implement inner rules (html, meta, etc)
- [x] Improve results display
- [ ] Implement `implies` and `excludes`
- [ ] Refactor Search class
- [ ] Implement phantomjs as an option