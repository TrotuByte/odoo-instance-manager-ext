import { StatusBarAlignment, StatusBarItem, window, ExtensionContext } from "vscode";
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
    const baseText = '$(database) PostgreSQL for Odoo:';
    function getStatusLabel(newStatus: PostgresStatus){
        switch (newStatus) {
            case PostgresStatus.notInitialized:
                return 'Not initialized';
            case PostgresStatus.running:
               return 'Running';
            case PostgresStatus.stopped:
                return 'Stopped';
            default:
                throw Error("Not valid status");
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
