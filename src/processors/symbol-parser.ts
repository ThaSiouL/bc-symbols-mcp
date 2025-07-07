import { BCSymbolReference, BCNamespace, BCTable, BCCodeunit, BCPage, BCPageExtension, BCEnumType, BCMethod, BCField, BCParameter, BCVariable, BCTypeDefinition, BCProperty, BCControl, BCAction, BCActionChange } from '../types/bc-types.js';
import { StreamingSymbolParser } from './streaming-parser.js';

export class SymbolParser {
  private streamingParser: StreamingSymbolParser;

  constructor() {
    this.streamingParser = new StreamingSymbolParser();
  }

  /**
   * Parse symbols using streaming approach for large files
   */
  async parseSymbolReferenceStreaming(symbolsBuffer: Buffer): Promise<BCSymbolReference> {
    const index = await this.streamingParser.parseSymbolsProgressive(symbolsBuffer);
    return this.streamingParser.createLazySymbolReference();
  }

  /**
   * Parse the complete symbol reference JSON (legacy method)
   */
  parseSymbolReference(symbolsData: any): BCSymbolReference {
    if (!symbolsData || !symbolsData.RuntimeVersion) {
      throw new Error('Invalid symbol reference data: missing RuntimeVersion');
    }

    // Handle both nested namespace structure and flat structure
    const namespaces = this.parseNamespaces(symbolsData.Namespaces || []);
    
    // If there are top-level objects, create a root namespace for them
    const rootNamespace: BCNamespace = {
      name: 'Root',
      namespaces: namespaces,
      tables: this.parseTables(symbolsData.Tables || []).concat(this.parseTableExtensions(symbolsData.TableExtensions || [])),
      codeunits: this.parseCodeunits(symbolsData.Codeunits || []),
      pages: this.parsePages(symbolsData.Pages || []),
      pageExtensions: this.parsePageExtensions(symbolsData.PageExtensions || []),
      reports: this.parseReports(symbolsData.Reports || []),
      xmlPorts: this.parseXmlPorts(symbolsData.XmlPorts || []),
      queries: this.parseQueries(symbolsData.Queries || []),
      controlAddIns: this.parseControlAddIns(symbolsData.ControlAddIns || []),
      enumTypes: this.parseEnumTypes(symbolsData.EnumTypes || []),
      dotNetPackages: this.parseDotNetPackages(symbolsData.DotNetPackages || []),
      interfaces: this.parseInterfaces(symbolsData.Interfaces || []),
      permissionSets: this.parsePermissionSets(symbolsData.PermissionSets || []),
      permissionSetExtensions: this.parsePermissionSetExtensions(symbolsData.PermissionSetExtensions || []),
      reportExtensions: this.parseReportExtensions(symbolsData.ReportExtensions || [])
    };

    return {
      runtimeVersion: symbolsData.RuntimeVersion,
      namespaces: [rootNamespace]
    };
  }

  /**
   * Parse namespaces recursively
   */
  private parseNamespaces(namespacesData: any[]): BCNamespace[] {
    if (!Array.isArray(namespacesData)) {
      return [];
    }

    return namespacesData.map(ns => ({
      name: ns.Name || '',
      namespaces: this.parseNamespaces(ns.Namespaces || []),
      tables: this.parseTables(ns.Tables || []),
      codeunits: this.parseCodeunits(ns.Codeunits || []),
      pages: this.parsePages(ns.Pages || []),
      pageExtensions: this.parsePageExtensions(ns.PageExtensions || []),
      reports: this.parseReports(ns.Reports || []),
      xmlPorts: this.parseXmlPorts(ns.XmlPorts || []),
      queries: this.parseQueries(ns.Queries || []),
      controlAddIns: this.parseControlAddIns(ns.ControlAddIns || []),
      enumTypes: this.parseEnumTypes(ns.EnumTypes || []),
      dotNetPackages: this.parseDotNetPackages(ns.DotNetPackages || []),
      interfaces: this.parseInterfaces(ns.Interfaces || []),
      permissionSets: this.parsePermissionSets(ns.PermissionSets || []),
      permissionSetExtensions: this.parsePermissionSetExtensions(ns.PermissionSetExtensions || []),
      reportExtensions: this.parseReportExtensions(ns.ReportExtensions || [])
    }));
  }

  /**
   * Parse tables
   */
  private parseTables(tablesData: any[]): BCTable[] {
    if (!Array.isArray(tablesData)) {
      return [];
    }

    return tablesData.map(table => ({
      id: table.Id || 0,
      name: table.Name || '',
      referenceSourceFileName: table.ReferenceSourceFileName || '',
      properties: this.parseProperties(table.Properties || []),
      fields: this.parseFields(table.Fields || []),
      keys: this.parseKeys(table.Keys || []),
      methods: this.parseMethods(table.Methods || []),
      variables: this.parseVariables(table.Variables || [])
    }));
  }

  /**
   * Parse codeunits
   */
  private parseCodeunits(codeunitsData: any[]): BCCodeunit[] {
    if (!Array.isArray(codeunitsData)) {
      return [];
    }

    return codeunitsData.map(codeunit => ({
      id: codeunit.Id || 0,
      name: codeunit.Name || '',
      referenceSourceFileName: codeunit.ReferenceSourceFileName || '',
      properties: this.parseProperties(codeunit.Properties || []),
      methods: this.parseMethods(codeunit.Methods || []),
      variables: this.parseVariables(codeunit.Variables || [])
    }));
  }

  /**
   * Parse pages
   */
  private parsePages(pagesData: any[]): BCPage[] {
    if (!Array.isArray(pagesData)) {
      return [];
    }

    return pagesData.map(page => ({
      id: page.Id || 0,
      name: page.Name || '',
      referenceSourceFileName: page.ReferenceSourceFileName || '',
      properties: this.parseProperties(page.Properties || []),
      controls: this.parseControls(page.Controls || []),
      actions: this.parseActions(page.Actions || []),
      methods: this.parseMethods(page.Methods || []),
      variables: this.parseVariables(page.Variables || []),
      hasActionsV2: page.HasActionsV2 || false
    }));
  }

  /**
   * Parse page extensions
   */
  private parsePageExtensions(pageExtensionsData: any[]): BCPageExtension[] {
    if (!Array.isArray(pageExtensionsData)) {
      return [];
    }

    return pageExtensionsData.map(pageExt => ({
      id: pageExt.Id || 0,
      name: pageExt.Name || '',
      referenceSourceFileName: pageExt.ReferenceSourceFileName || '',
      targetObject: pageExt.TargetObject || '',
      variables: this.parseVariables(pageExt.Variables || []),
      actionChanges: this.parseActionChanges(pageExt.ActionChanges || [])
    }));
  }

  /**
   * Parse enum types
   */
  private parseEnumTypes(enumTypesData: any[]): BCEnumType[] {
    if (!Array.isArray(enumTypesData)) {
      return [];
    }

    return enumTypesData.map(enumType => ({
      id: enumType.Id || 0,
      name: enumType.Name || '',
      referenceSourceFileName: enumType.ReferenceSourceFileName || '',
      properties: this.parseProperties(enumType.Properties || []),
      values: this.parseEnumValues(enumType.Values || [])
    }));
  }

  /**
   * Parse enum values
   */
  private parseEnumValues(enumValuesData: any[]): any[] {
    if (!Array.isArray(enumValuesData)) {
      return [];
    }

    return enumValuesData.map(value => ({
      ordinal: value.Ordinal || 0,
      name: value.Name || '',
      properties: this.parseProperties(value.Properties || [])
    }));
  }

  /**
   * Parse fields
   */
  private parseFields(fieldsData: any[]): BCField[] {
    if (!Array.isArray(fieldsData)) {
      return [];
    }

    return fieldsData.map(field => ({
      id: field.Id || 0,
      name: field.Name || '',
      typeDefinition: this.parseTypeDefinition(field.TypeDefinition),
      properties: this.parseProperties(field.Properties || [])
    }));
  }

  /**
   * Parse keys
   */
  private parseKeys(keysData: any[]): any[] {
    if (!Array.isArray(keysData)) {
      return [];
    }

    return keysData.map(key => ({
      name: key.Name || '',
      fieldNames: key.FieldNames || [],
      properties: this.parseProperties(key.Properties || [])
    }));
  }

  /**
   * Parse methods
   */
  private parseMethods(methodsData: any[]): BCMethod[] {
    if (!Array.isArray(methodsData)) {
      return [];
    }

    return methodsData.map(method => ({
      id: method.Id || 0,
      name: method.Name || '',
      parameters: this.parseParameters(method.Parameters || []),
      returnTypeDefinition: method.ReturnTypeDefinition ? this.parseTypeDefinition(method.ReturnTypeDefinition) : { name: 'void' }
    }));
  }

  /**
   * Parse parameters
   */
  private parseParameters(parametersData: any[]): BCParameter[] {
    if (!Array.isArray(parametersData)) {
      return [];
    }

    return parametersData.map(param => ({
      name: param.Name || '',
      typeDefinition: this.parseTypeDefinition(param.TypeDefinition),
      isVar: param.IsVar || false
    }));
  }

  /**
   * Parse variables
   */
  private parseVariables(variablesData: any[]): BCVariable[] {
    if (!Array.isArray(variablesData)) {
      return [];
    }

    return variablesData.map(variable => ({
      name: variable.Name || '',
      typeDefinition: this.parseTypeDefinition(variable.TypeDefinition)
    }));
  }

  /**
   * Parse type definition
   */
  private parseTypeDefinition(typeDefData: any): BCTypeDefinition {
    if (!typeDefData) {
      return { name: 'Unknown' };
    }

    return {
      name: typeDefData.Name || '',
      subtype: typeDefData.Subtype ? {
        name: typeDefData.Subtype.Name || '',
        id: typeDefData.Subtype.Id,
        moduleId: typeDefData.Subtype.ModuleId
      } : { name: '', id: 0, moduleId: '' },
      typeArguments: typeDefData.TypeArguments ? typeDefData.TypeArguments.map((arg: any) => this.parseTypeDefinition(arg)) : []
    };
  }

  /**
   * Parse properties
   */
  private parseProperties(propertiesData: any[]): BCProperty[] {
    if (!Array.isArray(propertiesData)) {
      return [];
    }

    return propertiesData.map(prop => ({
      name: prop.Name || '',
      value: prop.Value || ''
    }));
  }

  /**
   * Parse controls
   */
  private parseControls(controlsData: any[]): BCControl[] {
    if (!Array.isArray(controlsData)) {
      return [];
    }

    return controlsData.map(control => ({
      id: control.Id || 0,
      name: control.Name || '',
      kind: control.Kind || 0,
      typeDefinition: this.parseTypeDefinition(control.TypeDefinition),
      properties: this.parseProperties(control.Properties || []),
      controls: this.parseControls(control.Controls || [])
    }));
  }

  /**
   * Parse actions
   */
  private parseActions(actionsData: any[]): BCAction[] {
    if (!Array.isArray(actionsData)) {
      return [];
    }

    return actionsData.map(action => ({
      id: action.Id || 0,
      name: action.Name || '',
      kind: action.Kind || 0,
      properties: this.parseProperties(action.Properties || []),
      actions: this.parseActions(action.Actions || []),
      targetId: action.TargetId,
      targetName: action.TargetName
    }));
  }

  /**
   * Parse action changes
   */
  private parseActionChanges(actionChangesData: any[]): BCActionChange[] {
    if (!Array.isArray(actionChangesData)) {
      return [];
    }

    return actionChangesData.map(change => ({
      anchor: change.Anchor || '',
      changeKind: change.ChangeKind || 0,
      actions: this.parseActions(change.Actions || [])
    }));
  }

  /**
   * Parse table extensions
   */
  private parseTableExtensions(tableExtensionsData: any[]): any[] {
    if (!Array.isArray(tableExtensionsData)) {
      return [];
    }

    return tableExtensionsData.map(tableExt => ({
      id: tableExt.Id || 0,
      name: tableExt.Name || '',
      referenceSourceFileName: tableExt.ReferenceSourceFileName || '',
      targetObject: tableExt.TargetObject || '',
      properties: this.parseProperties(tableExt.Properties || []),
      fields: this.parseFields(tableExt.Fields || []),
      keys: this.parseKeys(tableExt.Keys || []),
      methods: this.parseMethods(tableExt.Methods || []),
      variables: this.parseVariables(tableExt.Variables || [])
    }));
  }

  /**
   * Parse reports (placeholder implementation)
   */
  private parseReports(reportsData: any[]): any[] {
    return this.parseBasicObjects(reportsData);
  }

  /**
   * Parse XML ports (placeholder implementation)
   */
  private parseXmlPorts(xmlPortsData: any[]): any[] {
    return this.parseBasicObjects(xmlPortsData);
  }

  /**
   * Parse queries (placeholder implementation)
   */
  private parseQueries(queriesData: any[]): any[] {
    return this.parseBasicObjects(queriesData);
  }

  /**
   * Parse control add-ins (placeholder implementation)
   */
  private parseControlAddIns(controlAddInsData: any[]): any[] {
    return this.parseBasicObjects(controlAddInsData);
  }

  /**
   * Parse .NET packages (placeholder implementation)
   */
  private parseDotNetPackages(dotNetPackagesData: any[]): any[] {
    return this.parseBasicObjects(dotNetPackagesData);
  }

  /**
   * Parse interfaces (placeholder implementation)
   */
  private parseInterfaces(interfacesData: any[]): any[] {
    return this.parseBasicObjects(interfacesData);
  }

  /**
   * Parse permission sets (placeholder implementation)
   */
  private parsePermissionSets(permissionSetsData: any[]): any[] {
    return this.parseBasicObjects(permissionSetsData);
  }

  /**
   * Parse permission set extensions (placeholder implementation)
   */
  private parsePermissionSetExtensions(permissionSetExtensionsData: any[]): any[] {
    return this.parseBasicObjects(permissionSetExtensionsData);
  }

  /**
   * Parse report extensions (placeholder implementation)
   */
  private parseReportExtensions(reportExtensionsData: any[]): any[] {
    return this.parseBasicObjects(reportExtensionsData);
  }

  /**
   * Generic parser for basic objects
   */
  private parseBasicObjects(objectsData: any[]): any[] {
    if (!Array.isArray(objectsData)) {
      return [];
    }

    return objectsData.map(obj => ({
      id: obj.Id || 0,
      name: obj.Name || '',
      referenceSourceFileName: obj.ReferenceSourceFileName || '',
      properties: this.parseProperties(obj.Properties || []),
      methods: this.parseMethods(obj.Methods || []),
      variables: this.parseVariables(obj.Variables || [])
    }));
  }

  /**
   * Find all objects of a specific type across all namespaces
   */
  findObjectsByType(symbols: BCSymbolReference, objectType: string): any[] {
    const results: any[] = [];

    const searchNamespaces = (namespaces: BCNamespace[]) => {
      for (const ns of namespaces) {
        switch (objectType.toLowerCase()) {
          case 'table':
          case 'tableextension':
            results.push(...ns.tables);
            break;
          case 'codeunit':
            results.push(...ns.codeunits);
            break;
          case 'page':
            results.push(...ns.pages);
            break;
          case 'pageextension':
            results.push(...ns.pageExtensions);
            break;
          case 'enum':
            results.push(...ns.enumTypes);
            break;
          case 'report':
            results.push(...ns.reports);
            break;
          case 'xmlport':
            results.push(...ns.xmlPorts);
            break;
          case 'query':
            results.push(...ns.queries);
            break;
          case 'controladdin':
            results.push(...ns.controlAddIns);
            break;
          case 'interface':
            results.push(...ns.interfaces);
            break;
          case 'permissionset':
            results.push(...ns.permissionSets);
            break;
          case 'permissionsetextension':
            results.push(...ns.permissionSetExtensions);
            break;
          case 'reportextension':
            results.push(...ns.reportExtensions);
            break;
        }
        
        // Recursively search nested namespaces
        searchNamespaces(ns.namespaces);
      }
    };

    searchNamespaces(symbols.namespaces);
    return results;
  }

  /**
   * Find an object by name and type
   */
  findObjectByName(symbols: BCSymbolReference, objectType: string, objectName: string): any | null {
    const objects = this.findObjectsByType(symbols, objectType);
    return objects.find(obj => obj.name === objectName) || null;
  }

  /**
   * Find an object by ID and type
   */
  findObjectById(symbols: BCSymbolReference, objectType: string, objectId: number): any | null {
    const objects = this.findObjectsByType(symbols, objectType);
    return objects.find(obj => obj.id === objectId) || null;
  }

  /**
   * Get all object types available in the symbols
   */
  getAvailableObjectTypes(symbols: BCSymbolReference): string[] {
    const types = new Set<string>();
    
    const scanNamespaces = (namespaces: BCNamespace[]) => {
      for (const ns of namespaces) {
        if (ns.tables.length > 0) {
          types.add('table');
          // Check if any of these are actually table extensions
          const hasTableExtensions = ns.tables.some(t => t.targetObject);
          if (hasTableExtensions) types.add('tableextension');
        }
        if (ns.codeunits.length > 0) types.add('codeunit');
        if (ns.pages.length > 0) types.add('page');
        if (ns.pageExtensions.length > 0) types.add('pageextension');
        if (ns.enumTypes.length > 0) types.add('enum');
        if (ns.reports.length > 0) types.add('report');
        if (ns.xmlPorts.length > 0) types.add('xmlport');
        if (ns.queries.length > 0) types.add('query');
        if (ns.controlAddIns.length > 0) types.add('controladdin');
        if (ns.interfaces.length > 0) types.add('interface');
        if (ns.permissionSets.length > 0) types.add('permissionset');
        if (ns.permissionSetExtensions.length > 0) types.add('permissionsetextension');
        if (ns.reportExtensions.length > 0) types.add('reportextension');
        
        scanNamespaces(ns.namespaces);
      }
    };

    scanNamespaces(symbols.namespaces);
    return Array.from(types);
  }
}