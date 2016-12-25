import * as fs from 'graceful-fs';

import { Vendor, BaseVendor, DetectionResult } from './BaseVendor'
import { Search } from './Search';

import * as yaml from 'js-yaml';

export type VendorConstructor = {new(): Vendor};
export type VendorReference = string;

function getVendorConstructors(): any {
  const vendors: any = {};

  if (fs.existsSync(`${__dirname}/vendors/vendors.yml`)) {
    let vendorsObj = yaml.safeLoad(fs.readFileSync(`${__dirname}/vendors/vendors.yml`).toString());
    Object.keys(vendorsObj).forEach(vendorName => {
      const properties = vendorsObj[vendorName];
      if (!properties.baseResult) {
        properties.baseResult = {};
      }
      properties.baseResult.vendor = vendorName;
      const adhocClass = class AdhocVendor extends BaseVendor {
        constructor(search: Search) {
          super(search);
          Object.assign(this, properties);
        }
      }
      vendors[vendorName] = adhocClass;
    });
  }

  const files = fs.readdirSync(`${__dirname}/vendors`);
  files.forEach((filename: string) => {
    if (filename === 'vendors.yml') {
      return;
    }

    let className = filename.substr(0, filename.length - 3);
    try {
      vendors[className] = require(`./vendors/${className}`)[className];
    }
    catch (e) {}
  });

  return vendors;
}

export class VendorManager {
  private static vendorConstructors = getVendorConstructors();
  private static vendorObjects = new Map<string, Vendor>();
  private static vendorInitPromises = new Map<VendorConstructor, Promise<void>>();

  private activeVendors = new Map<VendorConstructor, Vendor>();

  private inited = false;

  constructor(search: Search, activeVendorConstructors?: string[]) {
    if (!activeVendorConstructors) {
      activeVendorConstructors = Object.keys(VendorManager.vendorConstructors);
    }

    activeVendorConstructors.forEach(ctorName => {
      const ctor = VendorManager.vendorConstructors[ctorName];
      this.activeVendors.set(ctor, new ctor(search));
    });
  }

  async init(): Promise<void> {
    if (this.inited) {
      return;
    }

    let initPromises: Promise<void>[] = [];

    this.activeVendors.forEach((vendorObject, ctor) => {
      if (!VendorManager.vendorInitPromises.get(ctor)) {
        VendorManager.vendorInitPromises.set(ctor, vendorObject.init());
      }

      initPromises.push(VendorManager.vendorInitPromises.get(ctor));
    });

    await Promise.all(initPromises).catch(err => { throw err });

    this.inited = true;
  }

  async detect(search: Search): Promise<DetectionResult[]> {
    const detectionResults: DetectionResult[] = [];
    const activeVendorObjects = [];
    this.activeVendors.forEach(vendorObject => activeVendorObjects.push(vendorObject));

    const detectPromises = activeVendorObjects.map(async (vendorObj) => {
      const vendorResults = await vendorObj.detect();
      vendorResults.forEach(result => detectionResults.push(result));
    });

    await Promise.all(detectPromises);

    return detectionResults;
  }
}
