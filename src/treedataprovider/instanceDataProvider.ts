import { EventEmitter, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeItemLabel, Uri } from "vscode";
import { InstancesFetcher } from "../data/instances";
import { OdooInstance, OdooVersion, parseOdooVersion } from "./models/odooInstance";
import { join } from "path";

export enum OdooInstanceItemType{
  instanceOdoo="instanceOdoo",
  instanceModule="instanceModule"
}
export class OdooInstanceItem extends TreeItem {
  readonly instancePath?: Uri;
  readonly instanceVenvPath?: Uri;
  readonly instanceVersion?: OdooVersion;
  constructor(
    label: string | TreeItemLabel,
    instancePath?: Uri,
    instanceVenvPath?: Uri,
    instanceVersion?: OdooVersion,
    collapsibleState?: TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.instancePath = instancePath;
    this.instanceVenvPath = instanceVenvPath;
    this.instanceVersion = instanceVersion;
  }
}
class InstanceDataProvider implements TreeDataProvider<OdooInstanceItem> {
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
    if(element.contextValue === OdooInstanceItemType.instanceOdoo){
      return Promise.resolve(this.#getModules(element.instancePath!));
    }
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
      instancePath: instance.instancePath,
      instanceVenvPath: instance.instanceVenvPath,
      instanceVersion: version,
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
export {InstanceDataProvider};