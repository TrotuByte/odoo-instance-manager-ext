import { randomUUID } from "crypto";
import { ContainerDataJson, DockerNotAccessibleError, promiseExec } from "../extension_utils";
import { PostgresStatus } from "./postgresql.model";
import { EventEmitter, ExtensionContext, l10n } from "vscode";
export enum PostgreSQLSecretsKey {
    pgUser="PG_PASS",
    pgPass="PG_USER"
}
export type PostgresAuthData = {
    user: string;
    password: string;
};
export class PostgreSQLManager {
    static readonly containerName = 'pgsql-oim';
    static readonly networkName = 'oimvsc-net';
    readonly #eventEmitter = new EventEmitter<PostgresStatus>();
    readonly onReadStatus = this.#eventEmitter.event;
    async initializeContainer(context: ExtensionContext) {
        
        const authData: PostgresAuthData = this.genAuthData();
        await context.secrets.store(PostgreSQLSecretsKey.pgUser, authData.user);
        await context.secrets.store(PostgreSQLSecretsKey.pgPass, authData.password);
        await promiseExec(`docker run --network ${PostgreSQLManager.networkName} --name ${PostgreSQLManager.containerName}  -e POSTGRES_USER=${authData.user} -e POSTGRES_PASSWORD=${authData.password} -e POSTGRES_DB=postgres -d postgres`);
    }
    genAuthData(): PostgresAuthData {
        return {
            user: randomUUID().toString(),
            password: randomUUID().toString()
        };
    }
    async getStatus(): Promise<PostgresStatus> {
        let stdout;
        try {
            stdout = (await promiseExec(`docker container ls --format=json -a -f name=^${PostgreSQLManager.containerName}$`)).stdout;
        } catch (error) {
            throw new DockerNotAccessibleError();
        }        
        if(stdout.length < 1) {
            this.#eventEmitter.fire(PostgresStatus.notInitialized);
            return PostgresStatus.notInitialized;
        }
        const container: ContainerDataJson = JSON.parse(stdout);
        if(container.State === 'running') {
            this.#eventEmitter.fire(PostgresStatus.running);
            return PostgresStatus.running;
        }
        if(container.State === 'exited') {
            this.#eventEmitter.fire(PostgresStatus.stopped);
            return PostgresStatus.stopped;
        }
        throw Error(l10n.t('State not managed by the extension'));
    }
    async tryInitializeDockerNetwork() {
        try {
            await promiseExec(`docker network create -d bridge ${PostgreSQLManager.networkName}`);
        } catch (error) {
            const err: Error = error as Error;
            if(!err.message.includes(`Error response from daemon: network with name ${PostgreSQLManager.networkName} already exists`)){
                throw err;
            }
        }
    }
    async startContainer() {
        if((await this.getStatus()) === PostgresStatus.stopped){
            await promiseExec(`docker container start ${PostgreSQLManager.containerName}`);
        }
    }
    async stopContainer() {
        if((await this.getStatus()) === PostgresStatus.running){
            await promiseExec(`docker container stop ${PostgreSQLManager.containerName}`);
        }
    }
    
    dispose() {
        this.#eventEmitter.dispose();
    }
}