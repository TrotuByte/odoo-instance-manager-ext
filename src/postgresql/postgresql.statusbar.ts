import { StatusBarAlignment, StatusBarItem, window, ExtensionContext, l10n } from "vscode";
import { PostgresGlobalStateKey, PostgresStatus } from "./postgresql.model";
export type ChangePostgresStatusBarIndicator = (newStatus: PostgresStatus) => void;
export class ReadedStatusEvent extends Event{

}
export function createPostgresStatusBar(context: ExtensionContext, initialStatus: PostgresStatus): {
    statusBarItem: StatusBarItem;
    changeText: ChangePostgresStatusBarIndicator
}{
    const pgStatusBar: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    context.globalState.update(PostgresGlobalStateKey.postgresSqlStatus, initialStatus);
    const baseText = `$(database) ${l10n.t('PostgreSQL for Odoo')}:`;
    function getStatusLabel(newStatus: PostgresStatus){
        switch (newStatus) {
            case PostgresStatus.notInitialized:
                return l10n.t('Not initialized');
            case PostgresStatus.running:
               return l10n.t('Running');
            case PostgresStatus.stopped:
                return l10n.t('Stopped');
            default:
                throw Error(l10n.t("Not valid status"));
        }
    }
    pgStatusBar.command = 'oim.postgresql.statusbar';
    pgStatusBar.text = `${baseText} ${getStatusLabel(initialStatus)}`;
    pgStatusBar.show();
    return {
        statusBarItem: pgStatusBar,
        changeText: (status)=>{
            if(status !== context.globalState.get<PostgresStatus>(PostgresGlobalStateKey.postgresSqlStatus)){
                context.globalState.update(PostgresGlobalStateKey.postgresSqlStatus, status);
                pgStatusBar.text = `${baseText} ${getStatusLabel(status)}`;
            }
        }
    };
}
