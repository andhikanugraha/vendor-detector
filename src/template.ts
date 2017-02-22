import * as url from 'url';
import * as sortBy from 'lodash.sortby';
import * as uniq from 'lodash.uniq';
import { long2ip } from 'netmask';

function eqHostname(a, b) {
  if (a === b) {
    return true;
  }
  if (a.indexOf(b) !== -1) {
    return true;
  }
  if (b.indexOf(a) !== -1) {
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

  const data = sortBy(params.data, [
    x => x.hostname,
    x => x.vendor,
    x => x.rule.ruleType,
    x => x.rule.name
  ]);
  let lastHostname = '';
  let lastVendor = '';
  const ownDomainData = {};
  const linkedDomainData = {};
  const dataByHostname = {};

  data.forEach(row => {
    let parentObject;
    if (eqHostname(selfHostname, row.hostname)) {
      parentObject = ownDomainData;
    }
    else {
      parentObject = linkedDomainData;
    }
    if (lastHostname !== row.hostname) {
      parentObject[row.hostname] = {};
      lastHostname = row.hostname;
      lastVendor = '';
    }

    if (lastVendor.toLowerCase() !== row.vendor.toLowerCase()) {
      parentObject[row.hostname][row.vendor] = [];
      lastVendor = row.vendor;
    }

    parentObject[row.hostname][lastVendor].push(row);
  });

  params.ownDomainResults = ownDomainData;
  params.otherDomainResults = linkedDomainData;
}

function reason(result) {
  const rule = result.rule;
  if (result.impliedBy) {
    return `Implied by ${result.impliedBy}`;
  }

  switch (rule.ruleType) {
    case 'ipRange':
      if (rule.ipRange) {
        return `IP range: <code>${rule.ipRange}</code>`;
      }
      else if (rule.result.asNumber) {
        return `AS Number: <code>${rule.result.asNumber}</code>`;
      }
      else {
        return `IP range: <code>${long2ip(rule.first)}-${long2ip(rule.last)}</code>`;
      }
    case 'dns':
      return `DNS <code>${rule.recordType.toUpperCase()}</code> rule`;
    case 'script':
      return 'Script tag';
    case 'meta':
      return `Meta <code>${rule.name}</code> tag`;
    case 'header':
      return `HTTP <code>${rule.headerName}</code> header`;
    case 'html':
      return 'HTML source code';
    case 'url':
      return 'URL';
    default:
      let ruleType: string = rule.ruleType;
      return ruleType.substr(0, 1).toUpperCase() + ruleType.substr(1);
  }
}

function domainHelper(resultsByVendor: any[], hostname: string): string {
  let output = '';

  if (!resultsByVendor || resultsByVendor.length === 0) {
    output = `No results`;
    return;
  }

  output += `
  <div class="row" style="padding-top: 1rem">
    <div class="col-lg-4">
      <h5 style="padding-top: 0.75rem">${hostname}</h5>
    </div>
    <div class="col-lg-8">
      <table class="table table-bordered">
        <thead class="thead-default">
          <tr>
            <th width="50%">Vendor</th>
            <th width="50%">Detected through</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(resultsByVendor).forEach(vendorName => {
    let rows = resultsByVendor[vendorName];
    let numRows = rows.length;
    let firstRow = rows[0];
    let reasons = uniq(rows.map(row => reason(row)));
    let numReasons = reasons.length;
    let firstReason = reasons.shift();
    output += `
    <tr>
      <td width="50%" rowspan="${numReasons}">${(firstRow.vendor || '')}${(firstRow.region && ` <code>${firstRow.region}</code>` || '')}</td>
      <td width="50%">${firstReason}</td>
    </tr>
    `;
    reasons.forEach(reason => {
      output += `
      <tr>
        <td width="50%">${reason}</td>
      </tr>
      `;
    });
  });

  output += `
        </tbody>
      </table>
    </div>
  </div>
  `;

  return output;
}

function domains(domainsObj, mainHostname = '') {
  let output = '';

  if (mainHostname) {
    if (domainsObj[mainHostname]) {
      output += domainHelper(domainsObj[mainHostname], mainHostname);
    }
    if (domainsObj['www.' + mainHostname]) {
      output += domainHelper(domainsObj['www.' + mainHostname], 'www.' + mainHostname);
    }
  }

  Object.keys(domainsObj).forEach(hostname => {
    if (hostname === mainHostname || hostname === 'www.' + mainHostname) {
      return;
    }

    output += domainHelper(domainsObj[hostname], hostname);
  });

  return output;
}

export function template(params) {
  let body = '';
  separateData(params);

  if (params.ownDomainResults && Object.keys(params.ownDomainResults).length > 0) {
    body = `
    <hr>
    <h4 style="padding-top: 0.75rem">Detection results for <strong>${params.selfHostname}</strong></h4>
    ${domains(params.ownDomainResults, params.selfHostname)}
    `;
    if (params.otherDomainResults && Object.keys(params.otherDomainResults).length > 0) {
      body += `
      <hr>
      <h4 style="padding-top: 0.75rem">Resources linked by <strong>${params.selfHostname}</strong></h4>
      ${domains(params.otherDomainResults)}
      `;
    }
  }
  else if (params.q) {
    body = `
    <hr>
    <p>No results found for <strong>${params.selfHostname}</strong>.</p>
    `;
  }

  return `
  <!doctype html>
  <title>Vendor detector (alpha)</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <link rel="stylesheet" href="/css/bootstrap.css">
  <div class="container">
    <h1 style="padding-top: 2rem">Vendor detector <span class="badge badge-info">alpha</span></h1>
    <p>Type a URL into the box below to detect its vendors.</p>

    <form class="form" action="/" method="GET" onsubmit="document.getElementById('loadingMessage').style.display='block'">
      <p class="input-group">
        <input type="text" class="form-control" placeholder="Target URL" name="q" value="${params.q || ''}">
        <span class="input-group-btn">
          <button class="btn btn-primary" type="submit">Search</button>
        </span>
      </p>
    </form>

    <p id="loadingMessage" style="display: none">
      <img src="/rolling.svg" style="width:1.5rem;height:1.5rem;margin-right:0.5rem"> Loading results...
    </p>

    ${body}

    <footer class="text-muted">
      <p><small>
        An <a href="https://github.com/andhikanugraha/vendor-detector">open source project</a> by Andhika Nugraha.
        This product includes GeoLite data created by MaxMind, available from <a href="http://www.maxmind.com">http://www.maxmind.com</a>.
      </small></p>
    </footer>
  </div>
  `;
}
