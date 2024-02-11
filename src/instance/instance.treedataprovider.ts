import { EventEmitter, ExtensionContext, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeItemLabel, Uri, l10n, window, workspace } from "vscode";
import { OdooInstance, OdooVersion, OdooVersionData, parseOdooVersion } from "./instance.model";
import { join } from "path";
import { InstanceStatusManager } from "./instance.status.manager";
import { execSync } from "child_process";

export enum OdooInstanceItemType{
  instanceOdoo="instanceOdoo",
  instanceModule="instanceModule",
  instanceModuleGroup="instanceModuleGroup"
}
export enum OdooInstanceFolderModules{
  preAddedModules,
  userAddedModules
}
export function getFullId(id: string){
  return `${OdooInstanceItemType.instanceOdoo}_${id}`;
}
export class OdooInstanceItem extends TreeItem {
  readonly instanceId?: string;
  readonly instanceVersion?: OdooVersion;
  readonly instancePort?: number;
  readonly instanceAddonPath?: Uri;
  readonly instanceConfigPath?: Uri;
  readonly instanceLibPath?: Uri;
  readonly moduleFolderType?: OdooInstanceFolderModules;
  constructor(
    label: string | TreeItemLabel,
    instanceId?: string,
    instanceAddonPath?: Uri,
    instanceConfigPath?: Uri,
    instanceLibPath?: Uri,
    instanceVersion?: OdooVersion,
    instancePort?: number,
    collapsibleState?: TreeItemCollapsibleState,
    moduleFolderType?: OdooInstanceFolderModules
  ) {
    super(label, collapsibleState);
    this.instanceId = instanceId;
    this.instanceAddonPath = instanceAddonPath;
    this.instanceConfigPath = instanceConfigPath;
    this.instanceLibPath = instanceLibPath;
    this.instanceVersion = instanceVersion;
    this.instancePort = instancePort;
    this.moduleFolderType = moduleFolderType;
  }
}
export class InstanceDataProvider implements TreeDataProvider<OdooInstanceItem> {
  readonly #instancesFetcher: InstancesFetcher;
  readonly #instanceStatusManager: InstanceStatusManager;
  readonly #eventEmitter = new EventEmitter<
    void | OdooInstanceItem | OdooInstanceItem[] | null | undefined
  >();
  onDidChangeTreeData? = this.#eventEmitter.event;

  constructor(instancesFetcher: InstancesFetcher, instanceStatusManager: InstanceStatusManager) {
    this.#instancesFetcher = instancesFetcher;
    this.#instanceStatusManager = instanceStatusManager;
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
    if(element.contextValue?.includes(OdooInstanceItemType.instanceOdoo)){
      return Promise.resolve([
        this.#parseModuleGroup(OdooInstanceFolderModules.preAddedModules, element.instanceId!),
        this.#parseModuleGroup(OdooInstanceFolderModules.userAddedModules, element.instanceId!)
      ] as OdooInstanceItem[]);
    }
    if(element.contextValue === OdooInstanceItemType.instanceModuleGroup) {
      return Promise.resolve(this.#getModules(element.instanceId!, element.moduleFolderType!));
    }
    return Promise.resolve([]);
  }
  #getAllInstances(): OdooInstanceItem[] {
    const versions = this.#instancesFetcher.getAllInstances();
    const instancesTree: OdooInstanceItem[] = [];
    for (const versionData of versions){
      instancesTree.push(...versionData.instances.map(instance=>this.#parseInstance(instance, versionData.version)));
    }
    this.#instanceStatusManager.intialize(instancesTree);
    return instancesTree;
  }
  #getModules(instanceId: string, folderModule: OdooInstanceFolderModules): OdooInstanceItem[]{
    const modulesURL: string[] = [];
    try {
      switch(folderModule){
        case OdooInstanceFolderModules.preAddedModules:
          modulesURL.push(...execSync(`docker exec ${instanceId} sh -c "find /usr/lib/python3/dist-packages/odoo/addons -depth -mindepth 1 -maxdepth 1 -not -path "*/__pycache__" -type d"`, {encoding: 'utf-8'}).split('\n'));
          break;
        case OdooInstanceFolderModules.userAddedModules:
          modulesURL.push(...execSync(`docker exec ${instanceId} sh -c "find /mnt/extra-addons/. -depth -mindepth 1 -maxdepth 1 -not -path "*/__pycache__" -type d"`, {encoding: 'utf-8'}).split('\n'));
          break;
      }
    } catch (error) {
      if((error as Error).message.match(/Container .* is not running$/gm) !== null){
        window.showErrorMessage(l10n.t('The instance must to be started for get the module list. Start it and refresh the instances'));
      }else{
        console.error(error);
      }
    }
    return modulesURL.map(moduleUrl => {
      const moduleId = moduleUrl.substring(moduleUrl.lastIndexOf('/')+1).trim();
      if(moduleId.length > 0) {
        return this.#parseModule(moduleId);
      }
    }).filter(val=>val !== undefined)
    .sort((module, nextModule) => module!.instanceId!.toLowerCase().localeCompare(nextModule!.instanceId!.toLowerCase())) as OdooInstanceItem[];
  }
  #parseModuleGroup(folderModuleType: OdooInstanceFolderModules, instanceId: string): OdooInstanceItem{
    return {
      label: folderModuleType === OdooInstanceFolderModules.preAddedModules ? l10n.t('Preadded modules') : l10n.t('Your modules'),
      instanceId: instanceId,
      contextValue: OdooInstanceItemType.instanceModuleGroup,
      moduleFolderType: folderModuleType ,
      iconPath: new ThemeIcon('folder'),
      collapsibleState: TreeItemCollapsibleState.Collapsed
    };
  }
  #parseModule(moduleId: string, moduleName?: string): OdooInstanceItem{
    return {
      instanceId: moduleId,
      label: moduleName ?? moduleId,
      contextValue: OdooInstanceItemType.instanceModule,
      iconPath: new ThemeIcon('layers')
    };
  }
  #parseInstance(instance: OdooInstance, version?: OdooVersion): OdooInstanceItem{
    return {
      label: instance.instanceName,
      description: `v${version}`,
      instanceId: instance.instanceId,
      instanceAddonPath: instance.instanceAddonPath,
      instanceConfigPath: instance.instanceConfigPath,
      instanceLibPath: instance.instanceLibPath,
      instanceVersion: version,
      instancePort: instance.instancePort,
      contextValue: getFullId(instance.instanceId),
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      iconPath: {
        light: join(
          __filename,
          '..',
          '..',
          '..',
          'resources',
          'svg',
          'tree_view_instance_icon_light.svg'
        ),
        dark: join(
          __filename,
          '..',
          '..',
          '..',
          'resources',
          'svg',
          'tree_view_instance_icon_dark.svg'
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