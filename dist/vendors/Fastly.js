"use strict";
const BaseVendor_1 = require("../BaseVendor");
class Fastly extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.baseResult = { productCategories: ['cdn'] };
        this.hostnameDetectionRules = [/.fastly.net$/];
        this.headerDetectionRules = [{ Server: 'Akamai' }];
    }
}
exports.Fastly = Fastly;
