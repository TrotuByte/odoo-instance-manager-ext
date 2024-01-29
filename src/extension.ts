// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ModuleManifestProvider } from './treedataprovider/moduleManifestProvider';
import { InstanceDataProvider } from './treedataprovider/instanceDataProvider';
import { registerCommands } from './commands';
import { InstancesFetcher } from './data/instances';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "odoo-support-for-vscode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const instanceFetcher = new InstancesFetcher(context);
	await instanceFetcher.initialize();
	const instanceDataProviver = new InstanceDataProvider(instanceFetcher);
	const odooDisposables: vscode.Disposable[] = registerCommands(context, instanceFetcher, instanceDataProviver); 
	const actualWorkspace =
		vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;
	vscode.window.registerTreeDataProvider('moduleManifest', new ModuleManifestProvider(actualWorkspace));
	vscode.window.registerTreeDataProvider('odooInstanceManager', instanceDataProviver);
	context.subscriptions.push(...odooDisposables);
}

// This method is called when your extension is deactivated
export function deactivate() {}
