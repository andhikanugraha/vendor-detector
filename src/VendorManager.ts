import * as fs from 'graceful-fs';

import { BaseVendor, DetectionResult } from './BaseVendor';
import * as Vendor from './Vendor';
import { Search } from './Search';
import * as globby from 'globby';
import fetch from 'node-fetch';
import { Netmask } from 'netmask';


import * as yaml from 'js-yaml';

export class VendorManager {
  static instance: VendorManager;
  static getInstance(): VendorManager {
    if (!VendorManager.instance) {
      VendorManager.instance = new VendorManager();
    }

    return VendorManager.instance;
  }

  vendors = new Map<string, Vendor.Vendor>();

  // Canonized rules
  hostnameRules: Vendor.HostnameRuleObject[];
  ipRangeRules: Vendor.IpRangeRule[];
  headerRules: Vendor.HeaderRuleObject[];
  dnsRules: Vendor.DnsRuleObject[];
  metaRules: Vendor.MetaRuleObject[];
  htmlRules: Vendor.HtmlRule[];
  scriptRules: Vendor.ScriptRule[];

  private constructor() {

  }

  async init(): Promise<void> {
    await this.loadVendorObjects();

    for (let item of this.vendors) {
      const [vendorName, vendorObj] = item;
      if (vendorObj.load) {
        const delta = await vendorObj.load();
        Object.assign(vendorObj, delta);
        // TODO scheduling
      }
    }

    this.loadRules();
  }

  loadRules(): void {
    const ruleTypes = [
      'hostname',
      'ipRange',
      'header',
      'dns',
      'meta',
      'html',
      'script'
    ];

    const sortBy = {
      ipRangeRules: x => x.netmask.netLong,
      headerRules: x => x.headerName,
      metaRules: x => x.name
    };

    ruleTypes.forEach(ruleType => {
      const prop = ruleType + 'Rules';
      this[prop] = [];

      const canonizer = VendorRuleCanonizers[prop];

      this.vendors.forEach(vendorObj => {
        const baseResult = vendorObj.baseResult;
        vendorObj[prop].forEach(rule => {
          const canonizedRule: Vendor.VendorRuleObject = { ...canonizer(rule) };
          canonizedRule.result = {
            ...baseResult,
            ...canonizedRule.result
          };

          if (typeof canonizedRule.pattern === 'string') {
            canonizedRule.pattern = new RegExp(canonizedRule.pattern);
          }

          const sorter = sortBy[prop];
          if (sorter) {
            let i = 0;
            let inserted = false;
            while (i < this[prop].length && !inserted) {
              if (sorter(this[prop][i]) > sorter(canonizedRule)) {
                this[prop].splice(i, 0, canonizedRule);
                inserted = true;
              }
              else {
                i++;
              }
            }
            if (!inserted) {
              this[prop].push(canonizedRule);
            }
          }
          else {
            this[prop].push(canonizedRule);
          }
        });
      });
    });
  }

  async loadVendorObjects(): Promise<void> {
    await this.loadWappalyzer();

    const jsFiles: Array<string> = await globby(__dirname + '/vendors/**/*.js'); // use *.js after compilation
    jsFiles.forEach(file => this.loadJs(file));

    const yamlFiles: Array<string> = await globby(__dirname + '/vendors/**/*.{yml,yaml}');
    yamlFiles.forEach(file => this.loadYaml(file));
  }

  async loadWappalyzer() {
    // Load apps.json from GitHub instead of loading npm
    const WappalyzerAppsJsonUri = 'https://raw.githubusercontent.com/AliasIO/Wappalyzer/master/src/apps.json';
    const response = await fetch(WappalyzerAppsJsonUri);
    const responseJson = await response.json();
    const wappalyzerApps = responseJson.apps;
    Object.keys(wappalyzerApps).forEach(vendorName => {
      const convertedVendor = this.loadWappalyzerApp(vendorName, wappalyzerApps[vendorName]);
      this.mergeVendor(vendorName, convertedVendor);
    });
  }

  loadWappalyzerApp(vendorName: string, appObj: any): Vendor.Vendor {
    const newVendor: Vendor.Vendor = {};

    if (appObj.implies) {
      newVendor.implies = appObj.implies;
    }
    if (appObj.excludes) {
      newVendor.excludes = appObj.excludes;
    }

    if (appObj.html) {
      newVendor.htmlRules = [appObj.html];
    }
    if (appObj.script) {
      newVendor.scriptRules = [appObj.script];
    }

    // headers
    let headers = appObj.headers;
    if (headers) {
      newVendor.headerRules = [];
      Object.keys(headers).forEach(header => {
        const rule: Vendor.HeaderRuleObject = {
          headerName: header,
          pattern: headers[header]
        };
        newVendor.headerRules.push(rule);
      });
    }

    // meta tags
    let meta = appObj.meta;
    if (meta) {
      newVendor.metaRules = [];
      Object.keys(meta).forEach(metaName => {
        const rule: Vendor.MetaRuleObject = {
          name: metaName,
          pattern: meta[meta]
        };
      });
    }

    return newVendor;
  }

  loadYaml(pathToYaml: string): void {
    const vendorsObj = yaml.safeLoad(fs.readFileSync(pathToYaml).toString());
    if (!vendorsObj) {
      return;
    }

    const vendorNames = Object.keys(vendorsObj);
    vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
  }

  loadJs(pathToJs: string): void {
    const vendorsObj = require(pathToJs);
    const vendorNames = Object.keys(vendorsObj);
    vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
  }

  mergeVendor(vendorName: string, newVendorObj: Vendor.Vendor): void {
    if (!newVendorObj || typeof newVendorObj !== 'object') {
      return;
    }

    const existingVendorObj = this.vendors.get(vendorName);

    if (!existingVendorObj) {
      this.vendors.set(vendorName, this.prepareVendor(vendorName, newVendorObj));
      return;
    }

    const props = Object.keys(newVendorObj);
    props.forEach(prop => {
      const existingValue = existingVendorObj[prop];
      const newValue = newVendorObj[prop];
      if (existingValue instanceof Array && newValue instanceof Array) {
        newValue.forEach(item => existingValue.push(item));
      }
      else if (typeof existingValue === 'object') {
        Object.assign(existingValue, newValue);
      }
    });
  }

  prepareVendor(vendorName: string, vendorObj: Vendor.Vendor): Vendor.Vendor {
    const preparedVendor: Vendor.Vendor = {
      baseResult: {},
      hostnameRules: [],
      ipRangeRules: [],
      headerRules: [],
      dnsRules: [],
      metaRules: [],
      htmlRules: [],
      scriptRules: [],
      ...vendorObj
    };

    if (!preparedVendor.baseResult.vendor) {
      preparedVendor.baseResult.vendor = vendorName;
    }

    return preparedVendor;
  }
}

type Canonizer = (rule: any) => Vendor.VendorRuleObject;

function canonizeSingularRule(rule: any) {
  if (typeof rule === 'string' || rule instanceof RegExp) {
    return { pattern: rule };
  }

  return rule;
}

export const VendorRuleCanonizers = {
  hostnameRules(rule: any): Vendor.VendorRuleObject {
    return canonizeSingularRule(rule);
  },

  ipRangeRules(rule: any): Vendor.IpRangeRule {
    return {
      ...rule,
      netmask: new Netmask(rule.ipRange)
    };
  },

  headerRules(rule: any): Vendor.HeaderRuleObject {
    const keys = Object.keys(rule);
    if (keys.length === 1) {
      return {
        headerName: keys[0],
        pattern: new RegExp(rule[keys[0]])
      };
    }

    return rule;
  },

  dnsRules(rule: any): Vendor.DnsRuleObject {
    if (rule.recordType && rule.pattern) {
      return rule;
    }

    let recordType: string;
    let pattern: RegExp;
    const possibleProps = ['a', 'cname', 'mx', 'srv', 'soa'];
    const found = possibleProps.some(prop => {
      if (rule[prop]) {
        recordType = prop;
        pattern = new RegExp(recordType[prop]);
        return true;
      }

      return false;
    });

    if (found) {
      return { recordType, pattern };
    }

    return rule;
  },

  metaRules(rule: any): Vendor.MetaRuleObject {
    const keys = Object.keys(rule);
    if (keys.length === 1) {
      return {
        name: keys[0],
        pattern: new RegExp(rule[keys[0]])
      };
    }

    return rule;
  },

  htmlRules(rule: any): Vendor.VendorRuleObject {
    return canonizeSingularRule(rule);
  },

  // TODO
  scriptRules(rule: any): Vendor.ScriptRule {
    return canonizeSingularRule(rule);
  }
};
