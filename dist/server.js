"use strict";
const tslib_1 = require("tslib");
const url = require("url");
const express = require("express");
const Search_1 = require("./Search");
const VendorManager_1 = require("./VendorManager");
const netmask_1 = require("netmask");
const app = express();
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));
function eqHostname(a, b) {
    if (a === b) {
        return true;
    }
    if (a === 'www.' + b) {
        return true;
    }
    if ('www.' + a === b) {
        return true;
    }
    return false;
}
function separateData(params) {
    if (!params.data || !params.q) {
        return;
    }
    const selfHostname = url.parse(params.q).hostname;
    params.selfHostname = selfHostname;
    let existing = [];
    let filtered = params.data.filter(row => {
        if (!existing.some(r => (eqHostname(r.hostname, row.hostname) &&
            r.region === row.region &&
            r.vendor === row.vendor &&
            r.rule.ruleType === row.rule.ruleType))) {
            existing.push(row);
            return true;
        }
        return false;
    });
    const filter = row => eqHostname(row.hostname, selfHostname);
    params.selfRows = filtered.filter(filter);
    params.otherRows = filtered.filter(row => !filter(row));
}
function reason(rule) {
    switch (rule.ruleType) {
        case 'ipRange':
            if (rule.ipRange) {
                return `IP range: <code>${rule.ipRange}</code>`;
            }
            else if (rule.result.asNumber) {
                return `AS Number: <code>${rule.result.asNumber}</code>`;
            }
            else {
                return `IP range: <code>${netmask_1.long2ip(rule.first)}-${netmask_1.long2ip(rule.last)}</code>`;
            }
        case 'dns':
            return `DNS <code>${rule.recordType.toUpperCase()}</code> rule`;
        case 'script':
            return 'Script tag';
        case 'meta':
            return 'Meta tag';
        case 'header':
            return `HTTP <code>${rule.headerName}</code> header`;
        case 'html':
            return 'HTML source code';
        case 'url':
            return 'URL';
        default:
            let ruleType = rule.ruleType;
            return ruleType.substr(0, 1).toUpperCase() + ruleType.substr(1);
    }
}
function template(params) {
    let body = '';
    separateData(params);
    if (params.data) {
        body = `
<hr>
<h4 style="padding-bottom: 0.3em">Results for <strong>${params.selfHostname}</strong></h4>
<table class="table">
  <thead>
    <tr>
      <th>Hostname</th>
      <th>Vendor</th>
      <th>Detected through</th>
    </tr>
  </thead>
  <tbody>
    ${params.selfRows.map(row => `
      <tr>
        <td><strong>${row.hostname || ''}</strong></td>
        <td>${(row.vendor || '')}${(row.region && ` <code>${row.region}</code>` || '')}</td>
        <td>${reason(row.rule)}</td>
      </tr>`).join('')}
  </tbody>
</table>

<hr>
<h5 style="padding-bottom: 0.3em">Resources linked by <strong>${params.selfHostname}</strong></h5>
<table class="table">
  <thead>
    <tr>
      <th>Hostname</th>
      <th>Vendor</th>
      <th>Detected through</th>
    </tr>
  </thead>
  <tbody>
    ${params.otherRows.map(row => `
      <tr>
        <td><strong>${row.hostname || ''}</strong></td>
        <td>${(row.vendor || '')}${(row.region && ` <code>${row.region}</code>` || '')}</td>
        <td>${reason(row.rule)}</td>
      </tr>`).join('')}
  </tbody>
</table>
`;
    }
    return `
<!doctype html>
<title>Vendor detector (alpha)</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<link rel="stylesheet" href="css/bootstrap.css">
<div class="container">
  <h1 style="padding-top: 1em">Vendor detector <span class="tag tag-info">alpha</span></h1>
  <p class="lead">Type a URL into the box below to detect its vendors.</p>

  <form class="form" action="/" method="GET">
    <p class="input-group">
      <input type="text" class="form-control" placeholder="Target URL" name="q" value="${params.q || ''}">
      <span class="input-group-btn">
        <button class="btn btn-primary" type="submit">Search</button>
      </span>
    </p>
  </form>

  ${body}

  <hr>

  <footer>
    <p>An <a href="https://github.com/andhikanugraha/vendor-detector">open source project</a> by Andhika Nugraha</p>
  </footer>
</div>
`;
}
app.get('/', (req, res, next) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    try {
        let q = req.query.q;
        let data;
        if (q) {
            if (!q.match(/^http/)) {
                q = 'http://' + q;
            }
            data = yield Search_1.detectVendors(q);
        }
        if (req.accepts('html')) {
            res.send(template({ q, data }));
        }
        else {
            res.json(data);
        }
    }
    catch (e) {
        res.send(template({ q }));
    }
}));
VendorManager_1.VendorManager.getInstance().init().then(() => {
    app.listen(process.env.PORT || 3000, () => console.log('Express now listening'));
});
