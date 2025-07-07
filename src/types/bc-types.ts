// Business Central object type definitions

export interface BCApp {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  brief: string;
  platform: string;
  application: string;
  runtime: string;
  target: string;
  dependencies: BCAppDependency[];
  idRanges: BCIdRange[];
  filePath: string;
  fileHash: string;
  manifest: BCManifest;
  symbols: BCSymbolReference;
}

export interface BCAppDependency {
  id: string;
  name: string;
  publisher: string;
  minVersion: string;
  compatibilityId: string;
}

export interface BCIdRange {
  minObjectId: number;
  maxObjectId: number;
}

export interface BCManifest {
  app: BCAppInfo;
  idRanges: BCIdRange[];
  dependencies: BCAppDependency[];
  internalsVisibleTo: string[];
  features: string[];
  preprocessorSymbols: string[];
  suppressWarnings: BCSuppressWarning[];
  resourceExposurePolicy: BCResourceExposurePolicy;
  keyVaultUrls: string[];
  build: BCBuildInfo;
}

export interface BCAppInfo {
  id: string;
  name: string;
  publisher: string;
  brief: string;
  description: string;
  version: string;
  compatibilityId: string;
  privacyStatement: string;
  eula: string;
  help: string;
  helpBaseUrl: string;
  url: string;
  logo: string;
  platform: string;
  application: string;
  runtime: string;
  target: string;
  showMyCode: boolean;
}

export interface BCSuppressWarning {
  name: string;
}

export interface BCResourceExposurePolicy {
  allowDebugging: boolean;
  allowDownloadingSource: boolean;
  includeSourceInSymbolFile: boolean;
  applyToDevExtension: boolean;
}

export interface BCBuildInfo {
  by: string;
  timestamp: string;
  compilerVersion: string;
}

export interface BCSymbolReference {
  runtimeVersion: string;
  namespaces: BCNamespace[];
}

export interface BCNamespace {
  name: string;
  namespaces: BCNamespace[];
  tables: BCTable[];
  codeunits: BCCodeunit[];
  pages: BCPage[];
  pageExtensions: BCPageExtension[];
  reports: BCReport[];
  xmlPorts: BCXmlPort[];
  queries: BCQuery[];
  controlAddIns: BCControlAddIn[];
  enumTypes: BCEnumType[];
  dotNetPackages: BCDotNetPackage[];
  interfaces: BCInterface[];
  permissionSets: BCPermissionSet[];
  permissionSetExtensions: BCPermissionSetExtension[];
  reportExtensions: BCReportExtension[];
}

export interface BCTable {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  fields: BCField[];
  keys: BCKey[];
  methods: BCMethod[];
  variables: BCVariable[];
  targetObject?: string; // For table extensions
}

export interface BCCodeunit {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  methods: BCMethod[];
  variables: BCVariable[];
}

export interface BCPage {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  controls: BCControl[];
  actions: BCAction[];
  methods: BCMethod[];
  variables: BCVariable[];
  hasActionsV2: boolean;
}

export interface BCPageExtension {
  id: number;
  name: string;
  referenceSourceFileName: string;
  targetObject: string;
  variables: BCVariable[];
  actionChanges: BCActionChange[];
}

export interface BCReport {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  methods: BCMethod[];
  variables: BCVariable[];
}

export interface BCXmlPort {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  methods: BCMethod[];
  variables: BCVariable[];
}

export interface BCQuery {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  methods: BCMethod[];
  variables: BCVariable[];
}

export interface BCControlAddIn {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
}

export interface BCEnumType {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  values: BCEnumValue[];
}

export interface BCEnumValue {
  ordinal: number;
  name: string;
  properties: BCProperty[];
}

export interface BCDotNetPackage {
  id: number;
  name: string;
  referenceSourceFileName: string;
}

export interface BCInterface {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
  methods: BCMethod[];
}

export interface BCPermissionSet {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
}

export interface BCPermissionSetExtension {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
}

export interface BCReportExtension {
  id: number;
  name: string;
  referenceSourceFileName: string;
  properties: BCProperty[];
}

export interface BCField {
  id: number;
  name: string;
  typeDefinition: BCTypeDefinition;
  properties: BCProperty[];
}

export interface BCKey {
  name: string;
  fieldNames: string[];
  properties: BCProperty[];
}

export interface BCMethod {
  id: number;
  name: string;
  parameters: BCParameter[];
  returnTypeDefinition?: BCTypeDefinition;
}

export interface BCVariable {
  name: string;
  typeDefinition: BCTypeDefinition;
}

export interface BCParameter {
  name: string;
  typeDefinition: BCTypeDefinition;
  isVar?: boolean;
}

export interface BCTypeDefinition {
  name: string;
  subtype?: BCSubtype;
  typeArguments?: BCTypeDefinition[];
}

export interface BCSubtype {
  name: string;
  id?: number;
  moduleId?: string;
}

export interface BCProperty {
  name: string;
  value: string;
}

export interface BCControl {
  id: number;
  name: string;
  kind: number;
  typeDefinition: BCTypeDefinition;
  properties: BCProperty[];
  controls: BCControl[];
}

export interface BCAction {
  id: number;
  name: string;
  kind: number;
  properties: BCProperty[];
  actions: BCAction[];
  targetId?: number;
  targetName?: string;
}

export interface BCActionChange {
  anchor: string;
  changeKind: number;
  actions: BCAction[];
}

// Cache interfaces
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  fileHash: string;
}

export interface AppCache {
  [filePath: string]: CacheEntry<BCApp>;
}

// Query interfaces
export interface ObjectQuery {
  appIds?: string[];
  objectType?: string;
  objectName?: string;
  objectId?: number;
  includeExtensions?: boolean;
}

export interface DependencyQuery {
  appId: string;
  includeTransitive?: boolean;
  direction?: 'incoming' | 'outgoing' | 'both';
}

export interface ReferenceQuery {
  appIds?: string[];
  objectType: string;
  objectName: string;
  fieldName?: string;
  methodName?: string;
}