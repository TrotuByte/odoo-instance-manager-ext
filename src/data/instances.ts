import { ExtensionContext, Uri, workspace } from "vscode";
import { OdooVersion, OdooVersionData } from "../treedataprovider/models/odooInstance";
import { join } from "path";

export class InstancesFetcher{
    readonly #instances: OdooVersionData[] = [];
    readonly #instancePath;
    constructor(context: ExtensionContext){
        this.#instancePath = Uri.file(
          join(context.globalStorageUri.fsPath, 'oudu_instances.json')
        );
    }
    async initialize(){
      const instancesJson = await this.#fetchFromFile();
      if(instancesJson === undefined){
        for (const version of Object.values(OdooVersion)) {
          this.#instances.push({
            version: version,
            instances: [],
          });
        }
        await this.saveActualInstances();
        return;
      }
      this.#instances.push(...instancesJson);
    }
    addInstance(version: OdooVersion, id: string, name: string, path: Uri, venvPath: Uri): boolean{
      const versionData = this.#instances.filter(actGroup=>actGroup.version === version);
      if(versionData.length > 0){
        versionData.at(0)!.instances.push({instanceId: id, instanceName: name, instancePath: path, instanceVenvPath: venvPath});
        return true;
      }
      return false;
    }
    deleteInstance(version: OdooVersion, id: string): boolean{
      for(const versionData of this.#instances){
        if(versionData.version === version){
          for(let i = 0; i < versionData.instances.length; i++){
            if (versionData.instances[i].instanceId === id) {
              return versionData.instances.splice(i, 1).at(0)?.instanceId === id;
            }
          }
        }
      }
      return false;
    }
    async #fetchFromFile(){      
      try {
          const data = JSON.parse(
            new TextDecoder().decode(
              await workspace.fs.readFile(this.#instancePath)
            )
          ) as OdooVersionData[];
          for (const versionData of data) {
            for (const instanceData of versionData.instances){
              instanceData.instancePath = Uri.from(instanceData.instancePath);
              instanceData.instanceVenvPath = Uri.from(instanceData.instanceVenvPath);
            }
          }
          return data;
      } catch (error) {
        console.error(error);
        return undefined;
      }
      
    }
    async saveActualInstances(){
      await workspace.fs.writeFile(
        this.#instancePath,
        new TextEncoder().encode(JSON.stringify(this.#instances))
      );
    }
    getInstances(version: OdooVersion){      
        for(const instanceGroup of this.#instances){
            if(instanceGroup.version === version){
                return instanceGroup.instances;
            }
        }
        return null;
    }
    getAllInstances(){
      return this.#instances;
    }
}