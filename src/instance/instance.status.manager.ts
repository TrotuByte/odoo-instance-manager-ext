import { commands } from 'vscode';
import { OdooInstanceItem, getFullId } from './instance.treedataprovider';
import { ContainerDataJson, DockerNotAccessibleError, promiseExec } from '../extension_utils';
import { execSync } from 'child_process';
class InstanceStatusManagerNotInitializedError extends Error{
    constructor() {
        super('This instance of InstanceStatusManaged hasn\'t been initialized.');
    }
}
export class InstanceStatusManager{
    #initialized: boolean = false;
    #startedInstances: string[] = [];
    intialize(odooInstances: OdooInstanceItem[]){
        for (const instance of odooInstances){
            const instanceStatus = this.#getStatus(instance.id!);
            if(instanceStatus === 'running'){
                this.#startedInstances.push(getFullId(instance.id!));
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
    async startInstance(id: string){
        this.#checkInitialized();
        const arrayIndex = this.#startedInstances.indexOf(id);
        if(arrayIndex > -1){
            return;
        }
        try {
            await promiseExec(`docker container start ${id}`);
            this.#startedInstances.push(getFullId(id));
            this.#updateContext();
        } catch (error) {
            console.error(error);
        }
    }
    async stopInstance(id: string){
        this.#checkInitialized();
        const arrayIndex = this.#startedInstances.indexOf(getFullId(id));
        if(arrayIndex === -1){
            return;
        }
        try {
            await promiseExec(`docker container stop ${id}`);
            this.#startedInstances.splice(arrayIndex, 1);
            this.#updateContext();
        } catch (error) {
            console.error(error);
        }
    }
}