import {exec} from "child_process";
import { promisify } from "util";
import { commands, l10n } from "vscode";
export const promiseExec = promisify(exec);
export class DockerNotAccessibleError extends Error{
  constructor() {
      console.log(l10n.bundle);
      super(l10n.t("We can't use the command docker, please ensure you are running docker in your system or this user can use docker."));
      super.name = 'docker-not-accesible';
  }
}
export interface ContainerDataJson{
  // eslint-disable-next-line @typescript-eslint/naming-convention
  State: 'created' | 'running' | 'exited' | 'paused' | 'restarting' | 'removing' | 'dead'
}

export async function setDockerStarted(state: boolean | null){
  await commands.executeCommand('setContext', 'oim.startedDocker', state);
}