/*

*/

/**
 * A vendor definition is an object that contains:
 * * Rules that are used to identify the vendor
 * * Metadata about the vendor
 *
 * A "vendor" in this context is a vendor (i.e. Amazon)
 * or product that is served by a vendor (i.e. Amazon S3)
 *
 * Vendor definitions should maintain functional compatibility
 * with apps defined in Wappalyzer's apps.json list after conversion.
 *
 * Vendor definitions should comply with the VendorDefinition interface.
 * Vendor definitions can be defined in YAML or TypeScript.
 *
 * Vendor definitions in TypeScript can specify a load() method,
 * that is called when vendors are initialized, and called again
 * based on the schedule defined in the updateSchedule property.
 */
export interface Vendor {
  baseResult?: DetectionResult;
  hostnameRules?: HostnameRule[];
  ipRangeRules?: IpRangeRule[];
  headerRules?: HeaderRule[];
  dnsRules?: DnsRule[];
  metaRules?: MetaRule[];
  htmlRules?: HtmlRule[];
  scriptRules?: ScriptRule[];

  implies?: string[];
  excludes?: string[];

  // Optional: load IP ranges and things like that.
  // load() should resolve with an object to Object.assign() to the vendor definition
  load?(): Promise<Vendor>;
  updateSchedule?: any;
}

export interface DetectionResult {
  hostname?: string;
  url?: string;
  certainty?: string;
  vendor?: string;
  region?: string;
  message?: string;

  // Which rule was used to come up with the result
  rule?: VendorRuleObject;
}

export interface VendorRuleObject {
  ruleType?: string;
  pattern?: VendorRulePattern;
  result?: DetectionResult;
}

export type VendorRulePattern = string | RegExp;

// IP range rules
export interface IpRangeRule extends VendorRuleObject {
  ipRange: string;
  netmask?: any;
};

// HTML rules
export type HtmlRule = VendorRulePattern | HtmlRuleObject;
export type HtmlRuleObject = VendorRuleObject;

// Script rules
export type ScriptRule = VendorRulePattern | ScriptRuleObject;
export type ScriptRuleObject = VendorRuleObject;

// Meta rules
export type MetaRule = MetaRuleShorthand | MetaRuleObject;
export type MetaRuleShorthand = any; // i.e. { Generator: WordPress }
export interface MetaRuleObject extends VendorRuleObject {
  name: string; // name or http-equiv
}

// Hostname rules
export type HostnameRule = VendorRulePattern | HostnameRuleObject;
export type HostnameRuleObject = VendorRuleObject;

// Header rules
export type HeaderRule = HeaderRuleShortHand | HeaderRuleObject;
export type HeaderRuleShortHand = any; // i.e. { Server: nginx }
export interface HeaderRuleObject extends VendorRuleObject {
  headerName: string;
}

// DNS rules
export type DnsRule = DnsRuleObject | DnsARuleObject | DnsCnameRuleObject | DnsMxRuleObject | DnsSrvRuleObject | DnsSoaRuleObject;
export interface DnsRuleObject extends VendorRuleObject {
  recordType: string;
}
export interface DnsARuleObject extends VendorRuleObject {
  a: VendorRulePattern;
}
export interface DnsCnameRuleObject extends VendorRuleObject {
  cname: VendorRulePattern;
}
export interface DnsMxRuleObject extends VendorRuleObject {
  mx: VendorRulePattern;
}
export interface DnsSrvRuleObject extends VendorRuleObject {
  srv: VendorRulePattern;
}
export interface DnsSoaRuleObject extends VendorRuleObject {
  soa: VendorRulePattern;
}
