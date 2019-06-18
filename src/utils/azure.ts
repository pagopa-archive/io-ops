import * as execa from "execa";

export const config = {
  cosmosDatabaseName: "agid-documentdb-test",
  cosmosMessagesContainer: "messages",
  cosmosName: "agid-cosmosdb-test",
  resourceGroup: "agid-rg-test",
  storageMessagesContainer: "message-content",
  storageName: "agidstoragetest"
};

export const getCosmosEndpoint = async (resourceGroup: string, name: string) =>
  (await execa(
    `az cosmosdb show -g ${resourceGroup} -n ${name} --query documentEndpoint -o tsv`
  )).stdout;

export const getCosmosReadonlyKey = async (
  resourceGroup: string,
  name: string
) =>
  (await execa(
    `az cosmosdb list-keys -g ${resourceGroup} -n ${name} --query primaryReadonlyMasterKey -o tsv`
  )).stdout;

export const getCosmosWriteKey = async (resourceGroup: string, name: string) =>
  (await execa(
    `az cosmosdb list-keys -g ${resourceGroup} -n ${name} --query primaryMasterKey -o tsv`
  )).stdout;

export const getCosmosConnection = async (
  resourceGroup: string,
  name: string
) => {
  const [endpoint, key] = await Promise.all([
    getCosmosEndpoint(resourceGroup, name),
    getCosmosReadonlyKey(resourceGroup, name)
  ]);
  return { endpoint, key };
};

export const getStorageConnection = async (name: string) =>
  (await execa(
    `az storage account show-connection-string --name ${name} --output tsv`
  )).stdout;

/**
 * hasCosmosConnection checks if the host has az cli installed and resouceGroup and name
 * are valid inputs for cosmosdb
 */
export const hasCosmosConnection = async (
  resourceGroup: string,
  name: string
) => {
  try {
    const successExitCode = "SUCCESS";
    const documentEndpoint = await execa(
      `az cosmosdb show -g ${resourceGroup} -n ${name} --query documentEndpoint -o tsv`
    );
    const primaryReadonlyMasterKey = await execa(
      `az cosmosdb list-keys -g ${resourceGroup} -n ${name} --query primaryReadonlyMasterKey -o tsv`
    );

    return (
      documentEndpoint.exitCodeName === successExitCode &&
      primaryReadonlyMasterKey.exitCodeName === successExitCode
    );
  } catch (e) {
    return false;
  }
};
