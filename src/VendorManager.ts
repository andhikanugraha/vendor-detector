import * as url from 'url';

import * as mergeStream from 'merge-stream';
import * as fetchNS from 'node-fetch';

import { Vendor, DetectionResult, DetectionResultSet } from './BaseVendor'
import { AWS } from './vendors/AWS';
import { Search } from './Search';

export type VendorConstructor = {new(): Vendor};
export type VendorReference = string;

export class VendorManager {
  private static vendorConstructors = { AWS };
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
