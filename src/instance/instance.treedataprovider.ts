import { EventEmitter, ExtensionContext, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeItemLabel, Uri, workspace } from "vscode";
import { OdooInstance, OdooVersion, OdooVersionData, parseOdooVersion } from "./instance.model";
import { join } from "path";

export enum OdooInstanceItemType{
  instanceOdoo="instanceOdoo",
  instanceModule="instanceModule"
}
export class OdooInstanceItem extends TreeItem {
  readonly instanceVersion?: OdooVersion;
  readonly instancePort?: number;
  readonly instanceAddonPath?: Uri;
  readonly instanceConfigPath?: Uri;
  readonly instanceLibPath?: Uri;
  constructor(
    label: string | TreeItemLabel,
    instanceAddonPath?: Uri,
    instanceConfigPath?: Uri,
    instanceLibPath?: Uri,
    instanceVersion?: OdooVersion,
    instancePort?: number,
    collapsibleState?: TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.instanceAddonPath = instanceAddonPath;
    this.instanceConfigPath = instanceConfigPath;
    this.instanceLibPath = instanceLibPath;
    this.instanceVersion = instanceVersion;
    this.instancePort = instancePort;
  }
}
export class InstanceDataProvider implements TreeDataProvider<OdooInstanceItem> {
  readonly #instancesManager: InstancesFetcher;
  readonly #eventEmitter = new EventEmitter<
    void | OdooInstanceItem | OdooInstanceItem[] | null | undefined
  >();
  onDidChangeTreeData? = this.#eventEmitter.event;

  constructor(instancesManager: InstancesFetcher) {
    this.#instancesManager = instancesManager;
  }
  refresh() {
    this.#eventEmitter.fire();
  }
  getTreeItem(
    element: OdooInstanceItem
  ): OdooInstanceItem | Thenable<OdooInstanceItem> {
    return element;
  }
  getChildren(
    element?: OdooInstanceItem | undefined
  ): ProviderResult<OdooInstanceItem[]> {
    if (!element) {
      return Promise.resolve(this.#getAllInstances());
    }
    // if(element.contextValue === OdooInstanceItemType.instanceOdoo){
    //   return Promise.resolve(this.#getModules(element.instancePath!));
    // }
    return Promise.resolve([]);
  }
  #getAllInstances(): OdooInstanceItem[] {
    const versions = this.#instancesManager.getAllInstances();
    const instancesTree: OdooInstanceItem[] = [];
    for (const versionData of versions){
      instancesTree.push(...versionData.instances.map(instance=>this.#parseInstance(instance, versionData.version)));
    }
    return instancesTree;
  }
  #getModules(odooInstancePath: Uri): OdooInstanceItem[]{
    return [this.#parseModule('test_module')];
  }
  #parseModule(moduleId: string, moduleName?: string): OdooInstanceItem{
    return {
      id: moduleId,
      label: moduleName ?? moduleId,
      contextValue: OdooInstanceItemType.instanceModule,
      iconPath: new ThemeIcon('symbol-constructor')
    };
  }
  #parseInstance(instance: OdooInstance, version?: OdooVersion): OdooInstanceItem{
    return {
      id: instance.instanceId,
      label: instance.instanceName,
      description: `v${version}`,
      instanceAddonPath: instance.instanceAddonPath,
      instanceConfigPath: instance.instanceConfigPath,
      instanceLibPath: instance.instanceLibPath,
      instanceVersion: version,
      instancePort: instance.instancePort,
      contextValue: OdooInstanceItemType.instanceOdoo,
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      iconPath: {
        light: join(
          __filename,
          '..',
          '..',
          '..',
          'resources',
          'svg',
          'tree_view_manifest_data_icon_light.svg'
        ),
        dark: join(
          __filename,
          '..',
          '..',
          '..',
          'resources',
          'svg',
          'tree_view_manifest_data_icon_dark.svg'
        ),
      },
    };
  }
}
interface InstanceDataJSON{
  instances: OdooVersionData[]
  busyPorts: number[]
}
export class InstancesFetcher{
    readonly #instances: OdooVersionData[] = [];
    readonly #busyPorts: number[] = [];
    readonly #instancePath;
    constructor(context: ExtensionContext){
        this.#instancePath = Uri.file(
          join(context.globalStorageUri.fsPath, 'oudu_instances.json')
        );
    }
    async initialize(){
      const instanceData = await this.#fetchFromFile();
      if(instanceData === undefined){
        for (const version of Object.values(OdooVersion)) {
          this.#instances.push({
            version: version,
            instances: [],
          });
        }
        await this.saveActualInstances();
        return;
      }
      this.#instances.push(...instanceData.instances);
      this.#busyPorts.push(...instanceData.busyPorts);
    }
    addInstance(version: OdooVersion, id: string, name: string, configPath: Uri, addonsPath: Uri, libPath: Uri, port: number): boolean{
      const versionData = this.#instances.filter(actGroup=>actGroup.version === version);
      if(versionData.length > 0){
        versionData.at(0)!.instances.push({
          instanceId: id, 
          instanceName: name, 
          instanceConfigPath: configPath, 
          instanceAddonPath: addonsPath, 
          instanceLibPath: libPath, 
          instancePort: port});
        return true;
      }
      return false;
    }
    deleteInstance(version: OdooVersion, id: string): boolean{
      for(const versionData of this.#instances){
        if(versionData.version === version){
          for(let i = 0; i < versionData.instances.length; i++){
            if (versionData.instances[i].instanceId === id) {
              return versionData.instances.splice(i, 1).at(0)?.instanceId === id;
            }
          }
        }
      }
      return false;
    }
    async #fetchFromFile(){      
      try {
          const data = JSON.parse(
            new TextDecoder().decode(
              await workspace.fs.readFile(this.#instancePath)
            )
          ) as InstanceDataJSON;
          for (const versionData of data.instances) {
            for (const instanceData of versionData.instances){
              instanceData.instanceAddonPath = Uri.from(instanceData.instanceAddonPath);
              instanceData.instanceConfigPath = Uri.from(instanceData.instanceConfigPath);
              instanceData.instanceLibPath = Uri.from(instanceData.instanceLibPath);
            }
          }
          return data;
      } catch (error) {
        const nameError = (error as Error).name;
        if(nameError.includes('EntryNotFound')){
          return undefined;
        }
        throw error;
      }
      
    }
    async saveActualInstances(){
      await workspace.fs.writeFile(
        this.#instancePath,
        new TextEncoder().encode(JSON.stringify({
          instances: this.#instances,
          busyPorts: this.#busyPorts
        } as InstanceDataJSON)));
    }
    getInstances(version: OdooVersion){      
        for(const instanceGroup of this.#instances){
            if(instanceGroup.version === version){
                return instanceGroup.instances;
            }
        }
        return null;
    }
    getAllInstances(){
      return this.#instances;
    }
    getAvailablePort(): number{
      let port = 8069;
      while (this.#busyPorts.includes(port)) {
        port++;
      }
      return port;
    }
    addToBusyPorts(port: number){
      this.#busyPorts.push(port);
    }
    deleteFromBusyPorts(port: number): boolean{
      return this.#busyPorts.splice(this.#busyPorts.findIndex(actualPort=>actualPort === port)).length > 0;
    }
}