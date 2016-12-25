"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const AWS_1 = require("./vendors/AWS");
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
VendorManager.vendorConstructors = { AWS: AWS_1.AWS };
VendorManager.vendorObjects = new Map();
VendorManager.vendorInitPromises = new Map();
exports.VendorManager = VendorManager;
