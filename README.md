# vendor-detector

Detect _what_ and _how_ vendors are used by a site.


## Project rules

* Reuse wherever possible
  * In particular, [wappalyzer](https://github.com/AliasIO/wappalyzer)
* Extensible to support more vendors
* Not just what, but also how

## Detection methods

* Detection methods
  * Hostnames
  * IP ranges
  * DNS records (tbd)
  * HTTP headers
  * Meta tags (tbd)
  * HTML content (tbd)
  * etc (tbd)
* Sources of rules
  * [Wappalyzer's apps.json](https://github.com/AliasIO/wappalyzer) through npm
  * IP ranges published by AWS, Azure, etc

## To-do
[ ] Refactor vendor definitions
[ ] Maintain compatibility & absorb rules with wappalyzer