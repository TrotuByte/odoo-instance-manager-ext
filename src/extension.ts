// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { InstanceDataProvider, InstancesFetcher } from './instance/instance.treedataprovider';
import registerInstanceCommands from './instance/instance.command';
import { createPostgresStatusBar } from './postgresql/postgresql.statusbar';
import { PostgreSQLManager } from './postgresql/postgresql.manager';
import registerPostgresCommands from './postgresql/postgresql.command';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
const postgresManager = new PostgreSQLManager();
export async function activate(context: vscode.ExtensionContext) {
	await vscode.window.withProgress({title: "Loading Odoo Instance Manager for Visual Studio Code", location: vscode.ProgressLocation.Window}, async (progress, cancel) => {
		const instanceFetcher = new InstancesFetcher(context);
		await instanceFetcher.initialize();
		const instanceDataProviver = new InstanceDataProvider(instanceFetcher);

		// TreeDataProviders
		vscode.window.registerTreeDataProvider('odooInstanceManager', instanceDataProviver);

		// StatusBarItem
		const postgresStatusBar = createPostgresStatusBar(context, await postgresManager.getStatus());
		
		// Commands
		context.subscriptions.push( 
			...registerInstanceCommands(context, instanceFetcher, instanceDataProviver, postgresManager),
			...registerPostgresCommands(context, postgresManager, postgresStatusBar.statusBarItem),
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
