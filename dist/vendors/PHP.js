"use strict";
const BaseVendor_1 = require("../BaseVendor");
class PHP extends BaseVendor_1.BaseVendor {
    constructor() {
        super(...arguments);
        this.baseResult = { productCategories: ['server-side-programming'] };
        this.headerDetectionRules = [{ 'X-Powered-By': 'PHP' }];
    }
}
exports.PHP = PHP;
