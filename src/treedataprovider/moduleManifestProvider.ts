import { existsSync } from 'fs';
import path = require('path');
import {
  TreeItem,
  TreeDataProvider,
  ProviderResult,
  TreeItemCollapsibleState
} from 'vscode';
import { Manifest } from './models/moduleManifest';
import { WorkspaceRequiredDataProvider } from './workspaceRequiredDataProvider';
import { promiseExec } from '../extension_utils';


class ModuleManifestProvider extends WorkspaceRequiredDataProvider<ModuleManifestItem> {
  private manifestData: 
	Manifest | undefined;
  constructor(workspaceDir: string | undefined) {
    super(workspaceDir);
  }
  getChildren(
    element?: ModuleManifestItem | undefined
  ): ProviderResult<ModuleManifestItem[]> {
    if (!super.hasOpenedWorkspace()) {
      return Promise.resolve([]);
    }
    const manifestPath = path.join(this.workspaceDir!, '__manifest__.py');
    if (element) {
      return this.getChildList(manifestPath, element.id! as ManifestListKeys);
    } else {
      if (existsSync(manifestPath)) {
        return this.getModuleManifestItems(manifestPath);
      }
      return Promise.resolve([]);
    }
  }
  private async fetchManifestData(manifestPath: string): Promise<Manifest | undefined> {
    return promiseExec(
      `python "${path.join(
        __dirname,
        '..',
        '..',
        'resources',
        'python',
        'manifest_to_json.py'
      )}" ${manifestPath}`
    ).then(({stdout, stderr}) => stderr && stderr.length > 0 ? undefined :  JSON.parse(stdout));
  }
  private async getModuleManifestItems(
    manifestPath: string
  ): Promise<ModuleManifestItem[]> {
    this.manifestData = await this.fetchManifestData(manifestPath);
    return this.manifestData !== undefined ? Object.entries(this.manifestData!).map(([key, val]) =>
      this.isListItem(key, val)
        ? new ModuleManifestItem(
            key,
            undefined,
            TreeItemCollapsibleState.Collapsed,
          )
        : new ModuleManifestItem(
            key,
            `${val}`.trim(),
            TreeItemCollapsibleState.None,
          )
    ) : [];
  }
  private isListItem(manifestKey: string, manifestValue: any | undefined) {
    return (
      manifestKey === 'external_dependencies' ||
      manifestKey === 'demo' ||
      manifestKey === 'data' ||
      manifestKey === 'depends' ||
      (manifestKey === 'auto_install' && Array.isArray(manifestValue))
    );
  }
  private async getChildList(manifestPath: string, key: ManifestListKeys) {
    const manifestData = this.manifestData![key];
		if(Array.isArray(manifestData)){
			return manifestData.map(
        (val) =>
          new ModuleManifestItem(
            val as string,
            undefined,
            TreeItemCollapsibleState.None
          )
      );
		}
  }
}

class ModuleManifestItem extends TreeItem {
  constructor(
    public readonly manifestItem: string,
    public readonly manifestValue: string | undefined,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(`${manifestItem}`, collapsibleState);
  this.description = manifestValue;
  this.tooltip = manifestValue;
  }
  id?: string | undefined = this.manifestItem;
}
type ManifestListKeys = 'external_dependencies' | 'demo' | 'data' | 'depends' | 'auto_install';
export { ModuleManifestProvider };