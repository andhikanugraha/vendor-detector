"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const fs = require("graceful-fs");
const globby = require("globby");
const node_fetch_1 = require("node-fetch");
const netmask_1 = require("netmask");
const yaml = require("js-yaml");
class VendorManager {
    constructor() {
        this.vendors = new Map();
    }
    static getInstance() {
        if (!VendorManager.instance) {
            VendorManager.instance = new VendorManager();
        }
        return VendorManager.instance;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadVendorObjects();
            for (let item of this.vendors) {
                const [vendorName, vendorObj] = item;
                if (vendorObj.load) {
                    const delta = yield vendorObj.load();
                    Object.assign(vendorObj, delta);
                }
            }
            this.loadRules();
        });
    }
    loadRules() {
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
            const canonizer = exports.VendorRuleCanonizers[prop];
            this.vendors.forEach(vendorObj => {
                const baseResult = vendorObj.baseResult;
                vendorObj[prop].forEach(rule => {
                    const canonizedRule = __assign({}, canonizer(rule));
                    canonizedRule.result = __assign({}, baseResult, canonizedRule.result);
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
    loadVendorObjects() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadWappalyzer();
            const jsFiles = yield globby(__dirname + '/vendors/**/*.js'); // use *.js after compilation
            jsFiles.forEach(file => this.loadJs(file));
            const yamlFiles = yield globby(__dirname + '/vendors/**/*.{yml,yaml}');
            yamlFiles.forEach(file => this.loadYaml(file));
        });
    }
    loadWappalyzer() {
        return __awaiter(this, void 0, void 0, function* () {
            // Load apps.json from GitHub instead of loading npm
            const WappalyzerAppsJsonUri = 'https://raw.githubusercontent.com/AliasIO/Wappalyzer/master/src/apps.json';
            const response = yield node_fetch_1.default(WappalyzerAppsJsonUri);
            const responseJson = yield response.json();
            const wappalyzerApps = responseJson.apps;
            Object.keys(wappalyzerApps).forEach(vendorName => {
                const convertedVendor = this.loadWappalyzerApp(vendorName, wappalyzerApps[vendorName]);
                this.mergeVendor(vendorName, convertedVendor);
            });
        });
    }
    loadWappalyzerApp(vendorName, appObj) {
        const newVendor = {};
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
                const rule = {
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
                const rule = {
                    name: metaName,
                    pattern: meta[meta]
                };
            });
        }
        return newVendor;
    }
    loadYaml(pathToYaml) {
        const vendorsObj = yaml.safeLoad(fs.readFileSync(pathToYaml).toString());
        if (!vendorsObj) {
            return;
        }
        const vendorNames = Object.keys(vendorsObj);
        vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
    }
    loadJs(pathToJs) {
        const vendorsObj = require(pathToJs);
        const vendorNames = Object.keys(vendorsObj);
        vendorNames.forEach(vendorName => this.mergeVendor(vendorName, vendorsObj[vendorName]));
    }
    mergeVendor(vendorName, newVendorObj) {
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
    prepareVendor(vendorName, vendorObj) {
        const preparedVendor = __assign({ baseResult: {}, hostnameRules: [], ipRangeRules: [], headerRules: [], dnsRules: [], metaRules: [], htmlRules: [], scriptRules: [] }, vendorObj);
        if (!preparedVendor.baseResult.vendor) {
            preparedVendor.baseResult.vendor = vendorName;
        }
        return preparedVendor;
    }
}
exports.VendorManager = VendorManager;
function canonizeSingularRule(rule) {
    if (typeof rule === 'string' || rule instanceof RegExp) {
        return { pattern: rule };
    }
    return rule;
}
exports.VendorRuleCanonizers = {
    hostnameRules(rule) {
        return canonizeSingularRule(rule);
    },
    ipRangeRules(rule) {
        return __assign({}, rule, { netmask: new netmask_1.Netmask(rule.ipRange) });
    },
    headerRules(rule) {
        const keys = Object.keys(rule);
        if (keys.length === 1) {
            return {
                headerName: keys[0],
                pattern: new RegExp(rule[keys[0]])
            };
        }
        return rule;
    },
    dnsRules(rule) {
        if (rule.recordType && rule.pattern) {
            return rule;
        }
        let recordType;
        let pattern;
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
    metaRules(rule) {
        const keys = Object.keys(rule);
        if (keys.length === 1) {
            return {
                name: keys[0],
                pattern: new RegExp(rule[keys[0]])
            };
        }
        return rule;
    },
    htmlRules(rule) {
        return canonizeSingularRule(rule);
    },
    // TODO
    scriptRules(rule) {
        return canonizeSingularRule(rule);
    }
};
