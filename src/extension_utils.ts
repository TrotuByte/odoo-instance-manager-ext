import {exec} from "child_process";
import { promisify } from "util";
import { CancellationToken, ProviderResult, TreeDataProvider, TreeItem, Event } from "vscode";

export const promiseExec = promisify(exec);
export abstract class WorkspaceRequiredDataProvider<T extends TreeItem>
  implements TreeDataProvider<T> {
  public readonly workspaceDir: string | undefined;
  constructor(workspace: string | undefined) {
    this.workspaceDir = workspace;
  }
  onDidChangeTreeData?: Event<void | T | T[] | null | undefined> | undefined;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem> {
    return element;
  }
  abstract getChildren(element?: T | undefined): ProviderResult<T[]>;
  getParent?(element: T): ProviderResult<T>;
  resolveTreeItem?(
    item: TreeItem,
    element: T,
    token: CancellationToken
  ): ProviderResult<TreeItem>;
  hasOpenedWorkspace() {
    return this.workspaceDir !== undefined || this.workspaceDir !== null;
  }
}