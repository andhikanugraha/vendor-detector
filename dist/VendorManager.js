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
    constructor(activeVendorConstructors) {
        this.activeVendorObjects = [];
        this.inited = false;
        if (!activeVendorConstructors) {
            activeVendorConstructors = Object.keys(VendorManager.vendorConstructors);
        }
        this.activeVendorObjects = activeVendorConstructors.map(this.getVendorObject);
    }
    getVendorObject(vendorRef) {
        let vendorName;
        let vendorConstructor;
        if (typeof vendorRef === 'string') {
            vendorName = vendorRef;
            vendorConstructor = VendorManager.vendorConstructors[vendorName];
        }
        else {
            vendorName = vendorRef.name;
            vendorConstructor = vendorRef;
        }
        if (!VendorManager.vendorObjects.get(vendorName)) {
            VendorManager.vendorObjects.set(vendorName, new vendorConstructor());
        }
        return VendorManager.vendorObjects.get(vendorName);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inited) {
                return;
            }
            let initPromises = [];
            this.activeVendorObjects.forEach((vendorObject) => {
                if (!VendorManager.vendorInitPromises.get(vendorObject)) {
                    VendorManager.vendorInitPromises.set(vendorObject, vendorObject.init());
                }
                initPromises.push(VendorManager.vendorInitPromises.get(vendorObject));
            });
            yield Promise.all(initPromises);
            this.inited = true;
        });
    }
    detect(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const detectionResults = [];
            const detectPromises = this.activeVendorObjects.map((vendorObj) => __awaiter(this, void 0, void 0, function* () {
                const vendorResults = yield vendorObj.detect(search);
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
