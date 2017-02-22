"use strict";
const tslib_1 = require("tslib");
const express = require("express");
const Search_1 = require("./Search");
const VendorManager_1 = require("./VendorManager");
const template_1 = require("./template");
const app = express();
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));
app.get('/', (req, res, next) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    let q = req.query.q;
    try {
        let data;
        if (q) {
            if (!q.match(/^http/)) {
                q = 'http://' + q;
            }
            data = yield Search_1.detectVendors(q);
        }
        if (req.accepts('html')) {
            res.send(template_1.template({ q, data }));
        }
        else {
            res.set('Content-type', 'application/json');
            res.send(JSON.stringify(data, (k, v) => {
                if (v instanceof RegExp) {
                    return {
                        regex: v.toString()
                    };
                }
                return v;
            }, 2));
        }
    }
    catch (e) {
        res.send(template_1.template({ q, e }));
    }
}));
VendorManager_1.VendorManager.getInstance().init().then(() => {
    Search_1.Search.inited = true;
    app.listen(process.env.PORT || 3000, () => console.log('Express now listening'));
});
