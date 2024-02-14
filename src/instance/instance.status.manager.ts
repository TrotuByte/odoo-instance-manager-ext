import { commands, l10n, window } from 'vscode';
import { OdooInstanceItem, getFullId } from './instance.treedataprovider';
import { ContainerDataJson, DockerNotAccessibleError, promiseExec } from '../extension_utils';
import { execSync } from 'child_process';
import { join } from 'path';
class InstanceStatusManagerNotInitializedError extends Error{
    constructor() {
        super(l10n.t('This instance of InstanceStatusManaged hasn\'t been initialized.'));
    }
}
export class InstanceStatusManager{
    #initialized: boolean = false;
    #startedInstances: string[] = [];
    intialize(odooInstances: OdooInstanceItem[]){
        for (const instance of odooInstances) {
            const instanceStatus = this.#getStatus(instance.instanceId!);
            if(instanceStatus === 'running'){
                this.#startedInstances.push(getFullId(instance.instanceId!));
            }
        }
        this.#updateContext();
        this.#initialized = true;
    }
    async #updateContext() {
        await commands.executeCommand('setContext', 'oim.startedInstances', this.#startedInstances);
    }
    #checkInitialized() {
        if(!this.#initialized){
            throw new InstanceStatusManagerNotInitializedError();
        }
    }
    #getStatus(id: string){
        let stdout;
        try {
            stdout = execSync(`docker container ls --format=json -a -f name=^${id}$`).toString('utf-8');
        } catch (error) {
            throw new DockerNotAccessibleError();
        }
        if(stdout.length < 1) {
            return 'not-exist';
        }
        return (JSON.parse(stdout) as ContainerDataJson).State;
    }
    async startInstance(instance: OdooInstanceItem){
        this.#checkInitialized();
        const arrayIndex = this.#startedInstances.indexOf(instance.instanceId!);
        if(arrayIndex > -1){
            return;
        }
        try {
            await promiseExec(`docker container start ${instance.instanceId!}`, {cwd: join(instance.instanceAddonPath!.fsPath, '..')});
            this.#startedInstances.push(getFullId(instance.instanceId!));
            this.#updateContext();
        } catch (error) {
            window.showErrorMessage((error as Error).message);
        }
    }
    async stopInstance(instance: OdooInstanceItem){
        this.#checkInitialized();
        const arrayIndex = this.#startedInstances.indexOf(getFullId(instance.instanceId!));
        if(arrayIndex === -1){
            return;
        }
        try {
            await promiseExec(`docker container stop ${instance.instanceId!}`);
            this.#startedInstances.splice(arrayIndex, 1);
            this.#updateContext();
        } catch (error) {
            window.showErrorMessage((error as Error).message);
        }
    }
}