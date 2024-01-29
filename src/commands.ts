import * as vscode from "vscode";
import { OdooInstance, OdooVersion, parseOdooVersion } from "./treedataprovider/models/odooInstance";
import { InstancesFetcher } from "./data/instances";
import { promiseExec } from "./extension_utils";
import { join } from "path";
import { randomUUID } from "crypto";
import { InstanceDataProvider, OdooInstanceItem } from "./treedataprovider/instanceDataProvider";

interface QuickPickOdooInstance extends vscode.QuickPickItem{
	odooInstance?: OdooInstance
	version?: OdooVersion
}
async function askForInstance(instanceFetcher: InstancesFetcher){
	const quickPickItems: QuickPickOdooInstance[] = [];
  for (const version of instanceFetcher.getAllInstances()) {
    quickPickItems.push({
      label: `Odoo ${version.version}`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    quickPickItems.push(
      ...version.instances.map<QuickPickOdooInstance>((instance) => {
        return {
          label: instance.instanceName,
		  version: version.version,
		  odooInstance: instance
        };
      })
    );
  }
  return await vscode.window.showQuickPick(quickPickItems, {
    title: 'Select the instance',
	placeHolder: 'Filter'
  });
}
function createInstance(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceDataProvider: InstanceDataProvider ){
	return async (args: any[])=>{
		const title = 'Setup an Odoo instance';
		const getTitle = (actualStep: number, steps: number) =>
		title + ` (${actualStep}/${steps})`;
		const maxSteps = 2;
		let step = 1;
		// Get name for odoo instance
		const instanceName = await vscode.window.showInputBox({
			title: getTitle(step++, maxSteps),
			placeHolder: 'Instance name',
		});
		if (instanceName === undefined) {
			return;
		}
		// Select version of odoo
		const selectedVersion = parseOdooVersion(
		await vscode.window.showQuickPick(Object.values(OdooVersion), {
			title: getTitle(step++, maxSteps),
			placeHolder: 'Instance version',
		}));
		if (selectedVersion === undefined) {
			return;
		}
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'Creating Odoo instance',
			cancellable: false
		}, async (progress, token)=>{
			progress.report({ message: 'Creating python virtual env' });
			const odooInstanceId = randomUUID();
			const createVenv = await promiseExec(`python -m venv ${odooInstanceId}`, {
				cwd: context.globalStorageUri.fsPath,
			});
			if (createVenv.stderr !== '' || createVenv.stdout !== '') {
				return;
			}
			progress.report({message: `Cloning Odoo ${selectedVersion} Community Edition from https://github.com/odoo/odoo`});
			await promiseExec(`git clone https://github.com/odoo/odoo -b ${selectedVersion} --depth 1`, {cwd: join(context.globalStorageUri.fsPath, odooInstanceId)});
			progress.report({message: `Installing dependencies for Odoo ${selectedVersion} in virtual env`});
			// TODO: Instalar todo lo necesario dentro del entorno virtual
			// Guardar la instancia en el json
			progress.report({message: `Indexing instance`});
			const venvPath = join(context.globalStorageUri.fsPath, odooInstanceId);
			if(instanceFetcher.addInstance(selectedVersion, odooInstanceId, instanceName, vscode.Uri.file(join(venvPath, 'odoo')), vscode.Uri.file(venvPath))){
				await instanceFetcher.saveActualInstances();
				instanceDataProvider.refresh();
			}
		});
	};
}
function refreshInstances(instanceDataProvider: InstanceDataProvider){
	return (args: any[]) => instanceDataProvider.refresh();
}
function addOdooModule(instanceFetcher: InstancesFetcher){
	return async (odooInstance: OdooInstanceItem | undefined) => {
		vscode.window.showInformationMessage('Intentar añadir');
	};
}
function deleteOdooInstance(instanceFetcher: InstancesFetcher, instanceDataProvider: InstanceDataProvider){
	return async (instance: OdooInstanceItem | undefined)=>{
    let toRemove: {
      venv: vscode.Uri;
      version: OdooVersion;
      id: string;
    };
    if (!instance) {
      const instanceToRemove = await askForInstance(instanceFetcher);
      if (!instanceToRemove) {
        vscode.window.showErrorMessage('You has cancelled the deletion.');
        return;
      }
      toRemove = {
        venv: instanceToRemove.odooInstance!.instanceVenvPath!,
        version: instanceToRemove.version!,
        id: instanceToRemove.odooInstance!.instanceId,
      };
    } else {
      toRemove = {
        venv: instance!.instanceVenvPath!,
        version: instance.instanceVersion!,
        id: instance.id!,
      };
    }
    //TODO: Comprobar que no esté iniciada
    //TODO: Preguntar si quiere borrar el entorno virtual
    //TODO: Borrar entorno si si(cerrando las terminales y demás)
    await vscode.window.withProgress({
		title: "Deleting odoo instance",
		location: vscode.ProgressLocation.Window,
		cancellable: false
	}, 
	async (progress, cancelationToken) => {
		;
		// Borramos los datos
		progress.report({ message: 'Deleting the files' });
		try {
			await vscode.workspace.fs.delete(toRemove.venv, {
				recursive: true,
				useTrash: false,
			});
		} catch (error) {
			console.error(error);
			return;
		}
		progress.report({ message: 'Deleting from the index' });
		console.log(instanceFetcher.getAllInstances());
		// Borramos del indice la instancia
		if (instanceFetcher.deleteInstance(toRemove.version, toRemove.id)) {
			await instanceFetcher.saveActualInstances();
			instanceDataProvider.refresh();
			vscode.window.showInformationMessage('Deleted correctly');
		}
	});
  };
}
export function registerCommands(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceTreeDataProvider: InstanceDataProvider){
	return [
    	vscode.commands.registerCommand('osfv.createOdooInstance', createInstance(context, instanceFetcher, instanceTreeDataProvider)),
    	vscode.commands.registerCommand('osfv.refreshOdooInstances', refreshInstances(instanceTreeDataProvider)),
		vscode.commands.registerCommand('osfv.addOdooModule', addOdooModule(instanceFetcher)),
		vscode.commands.registerCommand('osfv.deleteOdooInstance', deleteOdooInstance(instanceFetcher, instanceTreeDataProvider))
  	];
}