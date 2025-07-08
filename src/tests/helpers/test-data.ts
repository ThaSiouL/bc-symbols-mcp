import { BCApp, BCManifest, BCSymbolReference } from '../../types/bc-types.js';

export function createMockBCApp(overrides?: Partial<BCApp>): BCApp {
  return {
    id: 'test-app-id',
    name: 'Test App',
    publisher: 'Test Publisher',
    version: '1.0.0',
    description: 'Test Description',
    brief: 'Test Brief',
    platform: '1.0.0',
    application: '1.0.0',
    runtime: '1.0.0',
    target: 'OnPrem',
    dependencies: [],
    idRanges: [],
    filePath: '/test/app.app',
    fileHash: 'test-hash',
    manifest: createMockManifest(),
    symbols: createMockSymbolReference(),
    ...overrides
  };
}

export function createMockManifest(): BCManifest {
  return {
    app: {
      id: 'test-app-id',
      name: 'Test App',
      publisher: 'Test Publisher',
      brief: 'Test Brief',
      description: 'Test Description',
      version: '1.0.0',
      compatibilityId: 'test-compatibility-id',
      privacyStatement: '',
      eula: '',
      help: '',
      helpBaseUrl: '',
      url: '',
      logo: '',
      platform: '1.0.0',
      application: '1.0.0',
      runtime: '1.0.0',
      target: 'OnPrem',
      showMyCode: false
    },
    idRanges: [],
    dependencies: [],
    internalsVisibleTo: [],
    features: [],
    preprocessorSymbols: [],
    suppressWarnings: [],
    resourceExposurePolicy: {
      allowDebugging: false,
      allowDownloadingSource: false,
      includeSourceInSymbolFile: false,
      applyToDevExtension: false
    },
    keyVaultUrls: [],
    build: {
      by: 'Test Builder',
      timestamp: '2024-01-01T00:00:00Z',
      compilerVersion: '1.0.0'
    }
  };
}

export function createMockSymbolReference(): BCSymbolReference {
  return {
    runtimeVersion: '1.0.0',
    namespaces: [{
      name: 'Root',
      namespaces: [],
      tables: [{
        id: 18,
        name: 'Customer',
        referenceSourceFileName: 'Customer.al',
        properties: [],
        fields: [],
        keys: [],
        methods: [],
        variables: []
      }],
      codeunits: [],
      pages: [],
      pageExtensions: [],
      reports: [],
      xmlPorts: [],
      queries: [],
      controlAddIns: [],
      enumTypes: [],
      dotNetPackages: [],
      interfaces: [],
      permissionSets: [],
      permissionSetExtensions: [],
      reportExtensions: []
    }]
  };
}

export function createMockCache() {
  return {
    getValidCachedApps: jest.fn().mockReturnValue([]),
    getApp: jest.fn().mockReturnValue(null),
    setApp: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalEntries: 0,
      totalMemoryUsage: 0,
      hitRate: 0,
      cacheSize: 0,
      oldestEntry: null,
      newestEntry: null
    }),
    clear: jest.fn(),
    deleteApp: jest.fn(),
    generateFileHash: jest.fn(),
    findAppById: jest.fn().mockReturnValue(null)
  };
}