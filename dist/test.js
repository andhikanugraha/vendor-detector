"use strict";
const tslib_1 = require("tslib");
const VendorManager_1 = require("./VendorManager");
const Search_1 = require("./Search");
function main() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const results = yield Search_1.detectVendors('https://www.joomla.org');
        console.log('\nFinal results:');
        console.dir(results, { colors: true, depth: 4 });
        const vm = VendorManager_1.VendorManager.getInstance();
        const availableVendors = vm.vendors;
        console.dir(availableVendors.get('Joomla'));
    });
}
main();
