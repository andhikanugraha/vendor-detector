import { AWS } from './vendors/AWS';
import { DetectionResult } from './DetectionStream';
import { Search } from './Search';
import * as mergeStream from 'merge-stream';

export type VendorConstructor = {new(): Vendor};
export type VendorReference = (VendorConstructor | string);

export interface Vendor {
  // Do things like load IP address ranges
  init(): Promise<void>;
  detect(Search): Promise<DetectionResult[]>;
}

export interface DetectionResult {
  type: string,
  vendor: string,
  product?: string,
  region?: string,
  ipRange?: string,
  hostname?: string,
  url?: string,
  message?: string
}

export class VendorManager {
  private static vendorConstructors = { AWS };
  private static vendorObjects = new Map<string, Vendor>();
  private static vendorInitPromises = new Map<Vendor, Promise<void>>();

  private activeVendorObjects: Vendor[] = [];

  private inited = false;

  constructor(activeVendorConstructors?: VendorReference[]) {
    if (!activeVendorConstructors) {
      activeVendorConstructors = Object.keys(VendorManager.vendorConstructors);
    }

    this.activeVendorObjects = activeVendorConstructors.map(this.getVendorObject);
  }

  private getVendorObject(vendorRef: VendorReference): Vendor {
    let vendorName: string;
    let vendorConstructor: {new(): Vendor};
    if (typeof vendorRef === 'string') {
      vendorName = vendorRef;
      vendorConstructor = VendorManager.vendorConstructors[vendorName];
    }
    else {
      vendorName = vendorRef.name;
      vendorConstructor = vendorRef;
    }

    if (!VendorManager.vendorObjects.get(vendorName)) {
      VendorManager.vendorObjects.set(vendorName, new vendorConstructor());
    }

    return VendorManager.vendorObjects.get(vendorName);
  }

  async init(): Promise<void> {
    if (this.inited) {
      return;
    }

    let initPromises: Promise<void>[] = [];

    this.activeVendorObjects.forEach((vendorObject: Vendor) => {
      if (!VendorManager.vendorInitPromises.get(vendorObject)) {
        VendorManager.vendorInitPromises.set(vendorObject, vendorObject.init());
      }

      initPromises.push(VendorManager.vendorInitPromises.get(vendorObject));
    });

    await Promise.all(initPromises);

    this.inited = true;
  }

  async detect(search: Search): Promise<DetectionResult[]> {
    const detectionResults: DetectionResult[] = [];

    const detectPromises = this.activeVendorObjects.map(async (vendorObj) => {
      const vendorResults = await vendorObj.detect(search);
      vendorResults.forEach(result => detectionResults.push(result));
    });

    await Promise.all(detectPromises);

    return detectionResults;
  }
}
