import { Uri } from "vscode";

export enum OdooVersion{
    fifteen="15.0", 
    sixteen="16.0",
    seventeen="17.0"
}
export function parseOdooVersion(odooVersion: string | undefined | null): OdooVersion | undefined{
    if(odooVersion === undefined || odooVersion === null){
        return undefined;
    }
    for(const enumEntry of Object.entries(OdooVersion)){
        if (enumEntry[1] === odooVersion) {
          return enumEntry[1];
        }
    }
}

export type OdooInstance = {
    instanceId: string;
    instanceName: string;
    instancePath: Uri;
    instanceVenvPath: Uri;
};
export type OdooVersionData = {
    version: OdooVersion;
    instances: OdooInstance[]
};