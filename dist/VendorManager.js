"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const fs = require("graceful-fs");
const BaseVendor_1 = require("./BaseVendor");
const yaml = require("js-yaml");
function getVendorConstructors() {
    const vendors = {};
    if (fs.existsSync(`${__dirname}/vendors/vendors.yml`)) {
        let vendorsObj = yaml.safeLoad(fs.readFileSync(`${__dirname}/vendors/vendors.yml`).toString());
        Object.keys(vendorsObj).forEach(vendorName => {
            const properties = vendorsObj[vendorName];
            if (!properties.baseResult) {
                properties.baseResult = {};
            }
            properties.baseResult.vendor = vendorName;
            const adhocClass = class AdhocVendor extends BaseVendor_1.BaseVendor {
                constructor(search) {
                    super(search);
                    Object.assign(this, properties);
                }
            };
            vendors[vendorName] = adhocClass;
        });
    }
    const files = fs.readdirSync(`${__dirname}/vendors`);
    files.forEach((filename) => {
        if (filename === 'vendors.yml') {
            return;
        }
        let className = filename.substr(0, filename.length - 3);
        try {
            vendors[className] = require(`./vendors/${className}`)[className];
        }
        catch (e) { }
    });
    return vendors;
}
class VendorManager {
    constructor(search, activeVendorConstructors) {
        this.activeVendors = new Map();
        this.inited = false;
        if (!activeVendorConstructors) {
            activeVendorConstructors = Object.keys(VendorManager.vendorConstructors);
        }
        activeVendorConstructors.forEach(ctorName => {
            const ctor = VendorManager.vendorConstructors[ctorName];
            this.activeVendors.set(ctor, new ctor(search));
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inited) {
                return;
            }
            let initPromises = [];
            this.activeVendors.forEach((vendorObject, ctor) => {
                if (!VendorManager.vendorInitPromises.get(ctor)) {
                    VendorManager.vendorInitPromises.set(ctor, vendorObject.init());
                }
                initPromises.push(VendorManager.vendorInitPromises.get(ctor));
            });
            yield Promise.all(initPromises).catch(err => { throw err; });
            this.inited = true;
        });
    }
    detect(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const detectionResults = [];
            const activeVendorObjects = [];
            this.activeVendors.forEach(vendorObject => activeVendorObjects.push(vendorObject));
            const detectPromises = activeVendorObjects.map((vendorObj) => __awaiter(this, void 0, void 0, function* () {
                const vendorResults = yield vendorObj.detect();
                vendorResults.forEach(result => detectionResults.push(result));
            }));
            yield Promise.all(detectPromises);
            return detectionResults;
        });
    }
}
VendorManager.vendorConstructors = getVendorConstructors();
VendorManager.vendorObjects = new Map();
VendorManager.vendorInitPromises = new Map();
exports.VendorManager = VendorManager;
