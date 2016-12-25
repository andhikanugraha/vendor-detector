"use strict";
const BaseVendor_1 = require("../BaseVendor");
class Incapsula extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.baseResult = { productCategories: ['cdn', 'security'] };
        this.headerDetectionRules = [{ 'X-CDN': 'Incapsula' }];
    }
}
exports.Incapsula = Incapsula;
