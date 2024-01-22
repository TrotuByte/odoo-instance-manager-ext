import { exec } from 'child_process';
import { existsSync } from 'fs';
import path = require('path');
import { promisify } from 'util';
import {
  TreeItem,
  TreeDataProvider,
  ProviderResult,
  TreeItemCollapsibleState,
  ThemeIcon,
  Uri,
  ThemeColor,
  ColorThemeKind, 
} from 'vscode';

const promiseExec = promisify(exec);

class ModuleManifestProvider implements TreeDataProvider<ModuleManifestItem> {
  private manifestData: 
	Manifest | undefined;
  constructor(private readonly workspaceDir: string | undefined) {}
  getTreeItem(element: ModuleManifestItem): TreeItem | Thenable<TreeItem> {
    return element;
  }
  getChildren(
    element?: ModuleManifestItem | undefined
  ): ProviderResult<ModuleManifestItem[]> {
    if (!this.workspaceDir) {
      return Promise.resolve([]);
    }
    const manifestPath = path.join(this.workspaceDir, '__manifest__.py');
    if (element) {
      return this.getChildList(manifestPath, element.id! as ManifestListKeys);
    } else {
      if (existsSync(manifestPath)) {
        return this.getModuleManifestItems(manifestPath);
      }
      return Promise.resolve([]);
    }
  }
  private async fetchManifestData(manifestPath: string) {
    return promiseExec(
      `python ${path.join(
        __filename,
        '..',
        '..',
        'resources',
        'python',
        'manifestToJson.py'
      )} ${manifestPath}`
    ).then((data) => JSON.parse(data.stdout));
  }
  private async getModuleManifestItems(
    manifestPath: string
  ): Promise<ModuleManifestItem[]> {
    this.manifestData = await this.fetchManifestData(manifestPath);
    return Object.entries(this.manifestData!).map(([key, val]) =>
      this.isListItem(key, val)
        ? new ModuleManifestItem(
            key,
            undefined,
            TreeItemCollapsibleState.Collapsed,
            undefined
          )
        : new ModuleManifestItem(
            key,
            `${val}`.trim(),
            TreeItemCollapsibleState.None,
            null
          )
    );
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
            TreeItemCollapsibleState.None,
            null
          )
      );
		}
  }
}

class ModuleManifestItem extends TreeItem {
  constructor(
    public readonly manifestItem: string,
    public readonly manifestValue: string | undefined,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly iconPath: any | null
  ) {
    super(
      manifestValue
        ? `${manifestItem}: ${manifestValue}`
        : manifestItem,
      collapsibleState
    );
    this.iconPath = iconPath === null ? {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'svg',
      'tree_view_manifest_data_icon_light.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'svg',
      'tree_view_manifest_data_icon_dark.svg'
    ),
  } : iconPath;
  }
  id?: string | undefined = this.manifestItem;
}

interface Manifest {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  website?: string;
  license?:
    | 'GPL-2'
    | 'GPL-2 or any later version'
    | 'GPL-3'
    | 'GPL-3 or any later version'
    | 'AGPL-3'
    | 'LGPL-3'
    | 'Other OSI approved licence'
    | 'OEEL-1'
    | 'OPL-1'
    | 'Other proprietary';
  category?: 'Uncategorized' | string;
  depends?: string[];
  data?: string[];
  demo?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  auto_install?: boolean | string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  external_dependencies: Map<string, string[]>;
  application: boolean;
  assets: Map<string, [string]>;
  installable: boolean;
  maintainer: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  pre_init_hook: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  post_init_hook: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  uninstall_hook: string;
}
type ManifestListKeys = 'external_dependencies' | 'demo' | 'data' | 'depends' | 'auto_install';
export { ModuleManifestProvider };