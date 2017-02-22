import * as express from 'express';

import { detectVendors, Search } from './Search';
import { VendorManager } from './VendorManager';
import { template } from './template';

const app = express();

app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js'));
app.use('/', express.static(__dirname + '/../public'));

app.get('/', async(req, res, next) => {
  let q = req.query.q;
  try {
    let data;
    if (q) {
      if (!q.match(/^http/)) {
        q = 'http://' + q;
      }
      data = await detectVendors(q);
    }

    if (req.accepts('html')) {
      res.send(template({q, data}));
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
    res.send(template({ q, e }));
    // next(e);
  }
});

VendorManager.getInstance().init().then(() => {
  Search.inited = true;
  app.listen(process.env.PORT || 3000, () => console.log('Express now listening'));
});

