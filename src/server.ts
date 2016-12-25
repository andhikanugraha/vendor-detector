import * as url from 'url';
import * as express from 'express';

import { detectVendors } from './Search';

const app = express();

app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));

function template(params) {
  let body = '';

  if (params.data) {
    body = `
<hr>
<h3>${params.q || ''}</h3>
<hr>
<h4>Details by hostname</h4>
<table class="table">
  <thead>
    <tr>
      <th>Hostname</th>
      <th>IP Address</th>
      <th>IP Range</th>
      <th>Vendor</th>
      <th>Region</th>
      <th>Product</th>
      <th>Product Categories</th>
    </tr>
  </thead>
  <tbody>
    ${params.data.map(row => `
      <tr>
        <td><strong>${row.hostname || ''}</strong></td>
        <td><code>${row.ipAddress || ''}</code></td>
        <td><code>${row.ipRange || ''}</code></td>
        <td>${row.vendor || ''}</td>
        <td>${row.region || ''}</td>
        <td>${row.product || ''}</td>
        <td>${row.productCategories && row.productCategories.join(', ') || ''}</td>
      </tr>`).join('')}
  </tbody>
</table>
`;
  }

  return `
<!doctype html>
<title>Vendor detector (alpha)</title>
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

app.get('/', async(req, res, next) => {
  try {
    let q = req.query.q;
    let data;
    if (q) {
      if (!q.match(/^http/)) {
        q = 'http://' + q;
      }
      data = await detectVendors(q);
      console.log(data);
    }

    if (req.accepts('html')) {
      res.send(template({q, data}));
    }
    else {
      res.json(data);
    }
  }
  catch (e) {
    next(e);
  }
});

app.listen(process.env.PORT || 3000);
