import {exec} from "child_process";
import { promisify } from "util";
import { CancellationToken, ProviderResult, TreeDataProvider, TreeItem, Event } from "vscode";

export const promiseExec = promisify(exec);
export class DockerNotAccessibleError extends Error{
  constructor() {
      super("We can't use the command docker, please ensure you are running docker in your system or this user can use docker.");
  }
}
export interface ContainerDataJson{
  // eslint-disable-next-line @typescript-eslint/naming-convention
  State: 'created' | 'running' | 'exited' | 'paused' | 'restarting' | 'removing' | 'dead'
}
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