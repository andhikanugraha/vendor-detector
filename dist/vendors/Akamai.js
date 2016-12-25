"use strict";
const BaseVendor_1 = require("../BaseVendor");
class Akamai extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.baseResult = { productCategories: ['cdn'] };
        this.hostnameDetectionRules = [/.edgesuite.net$/];
        this.headerDetectionRules = [{ Server: 'Akamai' }];
    }
}
exports.Akamai = Akamai;
