import { ExtensionContext, StatusBarItem, commands, l10n, window } from "vscode";
import { PostgresGlobalStateKey, PostgresStatus } from "./postgresql.model";
import { PostgreSQLManager } from "./postgresql.manager";

function manageContainerStatus(context: ExtensionContext, manager: PostgreSQLManager, postgresStatusItem: StatusBarItem){
    return async () =>{
        const actualState = context.globalState.get<PostgresStatus>(PostgresGlobalStateKey.postgresSqlStatus);
        switch(actualState){
            case PostgresStatus.notInitialized:
                postgresStatusItem.text = `$(loading~spin) ${l10n.t('Initializing containers network')}`;
                try {
                    await manager.tryInitializeDockerNetwork();
                } catch (error) {
                    window.showErrorMessage((error as Error).message);
                    break;
                }
                postgresStatusItem.text = `$(loading~spin) ${l10n.t('Initializing PostgreSQL container')}`;
                try {
                    await manager.initializeContainer(context);
                    await manager.getStatus();
                } catch (error) {
                    window.showErrorMessage((error as Error).message);
                    break;
                }
                break;
            case PostgresStatus.running:
                postgresStatusItem.text = `$(loading~spin) ${l10n.t('Stopping PostgreSQL container')}`;
                try {
                    await manager.stopContainer();
                    await manager.getStatus();
                } catch (error) {
                    window.showErrorMessage((error as Error).message);
                    break;
                }
                break;
            case PostgresStatus.stopped:
                postgresStatusItem.text = `$(loading~spin) ${l10n.t('Starting PostgreSQL container')}`;
                try {
                    await manager.startContainer();
                    await manager.getStatus();
                } catch (error) {
                    window.showErrorMessage((error as Error).message);
                    break;
                }
                break;
            case undefined:
                window.showErrorMessage(l10n.t('No state of container detected, please restart the editor'));
                break;
        }
    };
}
export default function registerPostgresCommands(context: ExtensionContext, manager: PostgreSQLManager, postgresStatusItem: StatusBarItem){
    return [
        commands.registerCommand('oim.postgresql.statusbar', manageContainerStatus(context, manager, postgresStatusItem))
    ];
}