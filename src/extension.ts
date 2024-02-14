// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { InstanceDataProvider, InstancesFetcher } from './instance/instance.treedataprovider';
import registerInstanceCommands from './instance/instance.command';
import { createPostgresStatusBar } from './postgresql/postgresql.statusbar';
import { PostgreSQLManager } from './postgresql/postgresql.manager';
import registerPostgresCommands from './postgresql/postgresql.command';
import { InstanceStatusManager } from './instance/instance.status.manager';
import { DockerNotAccessibleError, setDockerStarted } from './extension_utils';
import { PostgresStatus } from './postgresql/postgresql.model';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
const postgresManager = new PostgreSQLManager();
function showDockerNotInitializedError(error: DockerNotAccessibleError){
	vscode.window.showErrorMessage(error.message);
}
async function initializeExtension(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceDataProviver: InstanceDataProvider, instanceStatusManager: InstanceStatusManager, initialPostgreStatus: PostgresStatus){
	// StatusBarItem
	const postgresStatusBar = createPostgresStatusBar(context, await postgresManager.getStatus());
	context.subscriptions.push(
		// TreeDataProviders
		vscode.window.registerTreeDataProvider('oim.instances.view', instanceDataProviver),
		// Commands
		...registerInstanceCommands(context, instanceFetcher, instanceDataProviver, postgresManager, instanceStatusManager),
		...registerPostgresCommands(context, postgresManager, postgresStatusBar.statusBarItem),
		// Postgres StatusBarItem
		postgresStatusBar.statusBarItem,
		postgresManager.onReadStatus(newStatus=>postgresStatusBar.changeText(newStatus))
	);
	await setDockerStarted(true);
}
function refreshExtension(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceDataProviver: InstanceDataProvider, instanceStatusManager: InstanceStatusManager){
	return async () => {
		setDockerStarted(null);
		try {
			const status = await postgresManager.getStatus();
			context.subscriptions.forEach(disposable=> disposable.dispose());
			await initializeExtension(context, instanceFetcher, instanceDataProviver, instanceStatusManager, status);	
		} catch (error) {
			const pError = error as Error;
			if(pError.name !== 'docker-not-accesible'){
				throw error;
			}
			showDockerNotInitializedError(pError);
		}
	};
}
export async function activate(context: vscode.ExtensionContext) {
	await vscode.window.withProgress({title: vscode.l10n.t('Loading Odoo Instance Manager for Visual Studio Code'), location: vscode.ProgressLocation.Window}, async (progress, cancel) => {
		await setDockerStarted(null);
		const instanceFetcher = new InstancesFetcher(context);
		await instanceFetcher.initialize();
		const instanceStatusManager = new InstanceStatusManager();
		const instanceDataProviver = new InstanceDataProvider(instanceFetcher, instanceStatusManager);
		let initialStatus;
		try {
			initialStatus = await postgresManager.getStatus();
		} catch (error) {			
			const pError = (error as Error);
			if(pError.name === 'docker-not-accesible') {
				showDockerNotInitializedError(pError);
				await setDockerStarted(false);
			} else {
				throw error;
			}
		}
		if(initialStatus !== undefined){
			await initializeExtension(context, instanceFetcher, instanceDataProviver, instanceStatusManager, initialStatus);
		}else{
			context.subscriptions.push(vscode.commands.registerCommand('oim.refresh', refreshExtension(context, instanceFetcher, instanceDataProviver, instanceStatusManager)));
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {
	postgresManager.stopContainer();
	postgresManager.dispose();
}
