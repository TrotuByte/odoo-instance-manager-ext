// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { InstanceDataProvider, InstancesFetcher } from './instance/instance.treedataprovider';
import registerInstanceCommands from './instance/instance.command';
import { createPostgresStatusBar } from './postgresql/postgresql.statusbar';
import { PostgreSQLManager } from './postgresql/postgresql.manager';
import registerPostgresCommands from './postgresql/postgresql.command';
import { InstanceStatusManager } from './instance/instance.status.manager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
const postgresManager = new PostgreSQLManager();
export async function activate(context: vscode.ExtensionContext) {
	await vscode.window.withProgress({title: "Loading Odoo Instance Manager for Visual Studio Code", location: vscode.ProgressLocation.Window}, async (progress, cancel) => {
		const instanceFetcher = new InstancesFetcher(context);
		await instanceFetcher.initialize();
		const instanceStatusManager = new InstanceStatusManager();
		const instanceDataProviver = new InstanceDataProvider(instanceFetcher, instanceStatusManager);
		
		// StatusBarItem
		const postgresStatusBar = createPostgresStatusBar(context, await postgresManager.getStatus());
		context.subscriptions.push(
			// TreeDataProviders
			vscode.window.registerTreeDataProvider('odooInstanceManager', instanceDataProviver),
			// Commands
			...registerInstanceCommands(context, instanceFetcher, instanceDataProviver, postgresManager, instanceStatusManager),
			...registerPostgresCommands(context, postgresManager, postgresStatusBar.statusBarItem),
			// Postgres StatusBarItem
			postgresStatusBar.statusBarItem,
			postgresManager.onReadStatus(newStatus=>postgresStatusBar.changeText(newStatus))
		);
	});
}

// This method is called when your extension is deactivated
export function deactivate() {
	postgresManager.stopContainer();
	postgresManager.dispose();
}
