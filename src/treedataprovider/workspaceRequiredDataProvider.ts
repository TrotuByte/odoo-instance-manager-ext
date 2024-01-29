import { CancellationToken, Event, ProviderResult, TreeDataProvider, TreeItem } from "vscode";

abstract class WorkspaceRequiredDataProvider<T extends TreeItem>
  implements TreeDataProvider<T>
{
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
export {WorkspaceRequiredDataProvider};