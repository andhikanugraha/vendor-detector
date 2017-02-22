import * as express from 'express';

import { detectVendors, Search } from './Search';
import { VendorManager } from './VendorManager';
import { template } from './template';

const app = express();

async function outJson(req, res, next): Promise<void> {
  let q = req.query.q;
  try {
    if (q) {
      if (!q.match(/^http/)) {
        q = 'http://' + q;
      }
      res.locals.data = await detectVendors(q);
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
}

app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));
app.use('/', express.static(__dirname + '/../public'));

app.get('/', async(req, res, next) => {
  if (!req.accepts('html')) {
    return outJson(req, res, next);
  }
  let q = req.query.q;
  try {
    if (q) {
      if (!q.match(/^http/)) {
        q = 'http://' + q;
      }
      res.locals.data = await detectVendors(q);
    }

    res.send(template({q, data: res.locals.data}));
  }
  catch (e) {
    res.send(template({ q, e }));
  }
});

app.get('/api', outJson);

VendorManager.getInstance().init().then(() => {
  Search.inited = true;
  app.listen(process.env.PORT || 3000, () => console.log('Express now listening'));
});

