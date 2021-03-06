"use strict";
const tslib_1 = require("tslib");
const express = require("express");
const Search_1 = require("./Search");
const VendorManager_1 = require("./VendorManager");
const template_1 = require("./template");
const app = express();
function outJson(req, res, next) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let q = req.query.q;
        try {
            if (q) {
                if (!q.match(/^http/)) {
                    q = 'http://' + q;
                }
                res.locals.data = yield Search_1.detectVendors(q);
            }
            res.set('Content-type', 'application/json');
            res.send(JSON.stringify(res.locals.data, (k, v) => {
                if (v instanceof RegExp) {
                    return {
                        regex: v.toString()
                    };
                }
                return v;
            }, 2));
        }
        catch (e) {
            res.status(500).json({ error: e.getMessage() });
        }
    });
}
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));
app.use('/', express.static(__dirname + '/../public'));
app.get('/', (req, res, next) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (!req.accepts('html')) {
        return outJson(req, res, next);
    }
    let q = req.query.q;
    try {
        if (q) {
            if (!q.match(/^http/)) {
                q = 'http://' + q;
            }
            res.locals.data = yield Search_1.detectVendors(q);
        }
        res.send(template_1.template({ q, data: res.locals.data }));
    }
    catch (e) {
        res.send(template_1.template({ q, e }));
    }
}));
app.get('/api', outJson);
VendorManager_1.VendorManager.getInstance().init().then(() => {
    Search_1.Search.inited = true;
    app.listen(process.env.PORT || 3000, () => console.log('Express now listening'));
});
