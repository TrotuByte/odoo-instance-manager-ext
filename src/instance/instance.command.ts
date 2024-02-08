import * as vscode from 'vscode';
import { InstanceDataProvider, InstancesFetcher, OdooInstanceItem } from './instance.treedataprovider';
import { OdooInstance, OdooVersion, parseOdooVersion } from './instance.model';
import { promiseExec } from '../extension_utils';
import { PostgreSQLManager, PostgreSQLSecretsKey } from '../postgresql/postgresql.manager';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { PostgresStatus } from '../postgresql/postgresql.model';

interface QuickPickOdooInstance extends vscode.QuickPickItem{
	odooInstance?: OdooInstance
	version?: OdooVersion
}
enum ConfirmDeleteOption{
  yes='Yes',
  no='No'
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

function createInstance(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceDataProvider: InstanceDataProvider, postgresManager: PostgreSQLManager){
	return async (args: any[])=>{
    if(await postgresManager.getStatus() === PostgresStatus.notInitialized){
      vscode.window.showErrorMessage('Ensure that the PostgreSQL database is initialized');
      return;
    }
		const title = 'Setup an Odoo instance';
		const getTitle = (actualStep: number, steps: number) =>
		title + ` (${actualStep}/${steps})`;
		const maxSteps = 2;
		let step = 1;

		// Get name for odoo instance
		const containerName = await vscode.window.showInputBox({
			title: getTitle(step++, maxSteps),
			placeHolder: 'Instance name',
		});
		if (containerName === undefined) {
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
      title: 'Creating odoo instance',
      location: vscode.ProgressLocation.Notification
    }, async (progress) => {
      // Declare directories
      progress.report({message: 'Initializing folders...'});
      const containerId = randomUUID();
      const containerPath = vscode.Uri.file(join(context.globalStorageUri.fsPath, containerId));
      const addonsDirectoryName = 'addons', configDirectoryName = 'config', libraryDirectoryName = 'lib';
      const addonsDirectory = vscode.Uri.file(join(containerPath.fsPath, addonsDirectoryName));
      const configDirectory = vscode.Uri.file(join(containerPath.fsPath, configDirectoryName));
      const libraryDirectory = vscode.Uri.file(join(containerPath.fsPath, libraryDirectoryName));
      // Create directories
      try {
        await vscode.workspace.fs.createDirectory(addonsDirectory);
        await vscode.workspace.fs.createDirectory(configDirectory);
        // await vscode.workspace.fs.createDirectory(libraryDirectory);
      } catch (error) {
        vscode.window.showErrorMessage((error as Error).message);
        console.error(error);
        await vscode.workspace.fs.delete(containerPath, {recursive: true, useTrash: false});
        return; 
      }
      progress.report({message: 'Creating the container...'});
      const port = instanceFetcher.getAvailablePort();    
      try {
        await promiseExec(`docker run -d --name ${containerId} --network ${PostgreSQLManager.networkName} -p ${port}:8069 -v ${join('.', configDirectoryName)}:/etc/odoo -v ${join('.', addonsDirectoryName)}:/mnt/extra-addons -e HOST=${PostgreSQLManager.containerName} -e USER=${await context.secrets.get(PostgreSQLSecretsKey.pgUser)} -e PASSWORD=${await context.secrets.get(PostgreSQLSecretsKey.pgPass)} odoo:${selectedVersion}`, {cwd:  containerPath.fsPath});
        instanceFetcher.addToBusyPorts(port);
      } catch (error) {
        vscode.window.showErrorMessage((error as Error).message);
        console.error(error);
        await vscode.workspace.fs.delete(containerPath, {recursive: true, useTrash: false});
        return;
      }
      progress.report({message: 'Saving instance data'});
      instanceFetcher.addInstance(selectedVersion, 
        containerId, 
        containerName, 
        configDirectory, 
        addonsDirectory, 
        libraryDirectory, 
        port);
      await instanceFetcher.saveActualInstances();
      // Getting library of Odoo from container (Very slow)
      // try {
      //   progress.report({message: 'Getting the Odoo library from container'});
      //     for(const actFile of (await promiseExec(
      //       `docker exec ${containerId} sh -c "find /usr/lib/python3/dist-packages/odoo/ -not -path "*/__pycache__/*" -type f"`, {maxBuffer: Math.pow(1024, 5)}))
      //       .stdout
      //       .split('\n')) {
      //       const trimmedUrl = actFile.trim();
      //       if(trimmedUrl.length < 1){
      //         continue; 
      //       }
      //       const relativePathFile = trimmedUrl.substring(trimmedUrl.indexOf('odoo/'));
      //       const command = `docker cp ${containerId}:${trimmedUrl} ./${relativePathFile}`;
      //       try {
      //           await promiseExec(command, {cwd: libraryDirectory.fsPath});
      //       } catch (error) {
      //         const err: Error = error as Error;
      //         if(err.message.includes('directory') && err.message.includes('does not exist')){
      //           try {
      //             await vscode.workspace.fs.createDirectory(vscode.Uri.file(join(libraryDirectory.fsPath, relativePathFile.substring(0,relativePathFile.lastIndexOf('/')))));
      //             await promiseExec(command, {cwd: libraryDirectory.fsPath});
      //             progress.report({message: `Getting the Odoo library from container: ${relativePathFile}`});
      //           } catch (errorInCatch) {
      //             console.error(errorInCatch);
      //           }
      //           continue;
      //         }
      //         console.error(err);
      //       }
      //     }

      // } catch (error) {
      //   console.error(error);
      // }
      
      instanceDataProvider.refresh();
      return;
    });
	};
}

function refreshInstances(instanceDataProvider: InstanceDataProvider){
	return (args: any[]) => instanceDataProvider.refresh();
}

function deleteOdooInstance(instanceFetcher: InstancesFetcher, instanceDataProvider: InstanceDataProvider){
	return async (instance: OdooInstanceItem | undefined)=>{
    if((await vscode.window.showWarningMessage('You are going to delete a instance and all the data related', 
    {
      modal: true,
      detail: 'Are you sure?'
    }, 
    {title: 'Yes'}, {title: 'No', isCloseAffordance: true}))?.title !== ConfirmDeleteOption.yes){
      return; 
    }
    let toRemove: {
      odooInstance: vscode.Uri;
      version: OdooVersion;
      id: string;
      port: number;
    };
    if (!instance) {
      const instanceToRemove = await askForInstance(instanceFetcher);
      if (!instanceToRemove) {
        vscode.window.showErrorMessage('You has cancelled the deletion.');
        return;
      }
      toRemove = {
        odooInstance: vscode.Uri.file(join(instanceToRemove.odooInstance!.instanceAddonPath!.fsPath, '..')),
        version: instanceToRemove.version!,
        id: instanceToRemove.odooInstance!.instanceId,
        port: instanceToRemove.odooInstance!.instancePort
      };
    } else {
      toRemove = {
        odooInstance: vscode.Uri.file(join(instance.instanceAddonPath!.fsPath, '..')),
        version: instance.instanceVersion!,
        id: instance.id!,
        port: instance.instancePort!
      };
    }
    await vscode.window.withProgress({location: vscode.ProgressLocation.Notification, cancellable: false}, async (progress) => {
      progress.report({message: 'Stopping container...'});
      try {
        await promiseExec(`docker container stop ${toRemove.id}`);
      } catch (error) {
        console.error(error);
      }
      progress.report({message: 'Removing container...'});
      try {
        await promiseExec(`docker container rm ${toRemove.id}`);
      } catch (error) {
        console.error(error);
      }
      try {
        progress.report({message: 'Removing container data...'});
        await vscode.workspace.fs.delete(toRemove.odooInstance, {recursive: true, useTrash: false});
      } catch (error) {
        console.error(error);
      }
      progress.report({message: 'Deleting container from index...'});
      instanceFetcher.deleteFromBusyPorts(toRemove.port);
      if(instanceFetcher.deleteInstance(toRemove.version, toRemove.id)){
        await instanceFetcher.saveActualInstances();
        instanceDataProvider.refresh();
      }
      return;
    });
  };
}

function openInBrowser(instanceFetcher: InstancesFetcher){
  return async (instance: OdooInstanceItem | undefined) => {
    let port = instance?.instancePort;
    if(!port){
      const askedInstance = await askForInstance(instanceFetcher);
      if(!askedInstance){
        return;
      }
      port = askedInstance.odooInstance!.instancePort;
    }
    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
  };
}

export default function registerInstanceCommands(context: vscode.ExtensionContext, instanceFetcher: InstancesFetcher, instanceDataProvider: InstanceDataProvider, postgresManager: PostgreSQLManager){
  return [
    vscode.commands.registerCommand('oim.instance.create', createInstance(context, instanceFetcher, instanceDataProvider, postgresManager)),
    vscode.commands.registerCommand('oim.instance.refresh', refreshInstances(instanceDataProvider)),
    vscode.commands.registerCommand('oim.instance.delete', deleteOdooInstance(instanceFetcher, instanceDataProvider)),
    vscode.commands.registerCommand('oim.instance.open', openInBrowser(instanceFetcher))
  ];
}