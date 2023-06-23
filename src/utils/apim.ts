import { ApiManagementClient } from "@azure/arm-apimanagement";
import { AzureAuthorityHosts, ClientSecretCredential } from "@azure/identity";

export interface IServicePrincipalCreds {
  readonly clientId: string;
  readonly secret: string;
  readonly tenantId: string;
}

export interface IAzureApimConfig {
  readonly subscriptionId: string;
  readonly apimResourceGroup: string;
  readonly apim: string;
}
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getApimClient(
  servicePrincipalCreds: IServicePrincipalCreds,
  subscriptionId: string
): ApiManagementClient {
  const credential = new ClientSecretCredential(
    servicePrincipalCreds.tenantId,
    servicePrincipalCreds.clientId,
    servicePrincipalCreds.secret,
    {
      authorityHost: AzureAuthorityHosts.AzurePublicCloud,
    }
  );
  return new ApiManagementClient(credential, subscriptionId);
}
