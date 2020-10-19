import {
  ApiHeaderJson,
  composeHeaderProducers,
  composeResponseDecoders,
  constantResponseDecoder,
  createFetchRequestForApi,
  ioResponseDecoder,
  ReplaceRequestParams,
  RequestHeaderProducer,
  RequestParams,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";
import { ProblemJson } from "italia-ts-commons/lib/responses";
import { Omit } from "italia-ts-commons/lib/types";
import nodeFetch from "node-fetch";
import {
  createDevelopmentProfileDefaultDecoder,
  CreateDevelopmentProfileT,
  createServiceDefaultDecoder,
  CreateServiceT,
  createSubscriptionDefaultDecoder,
  CreateSubscriptionT,
  createUserDefaultDecoder,
  CreateUserT,
  getServiceDefaultDecoder,
  getServicesDefaultDecoder,
  GetServicesT,
  GetServiceT,
  getSubscriptionKeysDefaultDecoder,
  GetSubscriptionKeysT,
  getUserDefaultDecoder,
  getUsersDefaultDecoder,
  GetUsersT,
  GetUserT,
  RegenerateSubscriptionKeysDefaultDecoder,
  RegenerateSubscriptionKeysT,
  updateGroupsDefaultDecoder,
  UpdateGroupsT,
  updateServiceDefaultDecoder,
  UpdateServiceT,
  updateUserDefaultDecoder,
  UpdateUserT,
  UploadServiceLogoT
} from "../generated/requestTypes";

function SubscriptionKeyHeaderProducer<P>(
  token: string
): RequestHeaderProducer<P, "Ocp-Apim-Subscription-Key"> {
  return () => ({
    "Ocp-Apim-Subscription-Key": token
  });
}

// tslint:disable-next-line:no-big-function
export function ApiClient(
  baseUrl: string,
  token: string,
  // tslint:disable-next-line:no-any
  fetchApi: typeof fetch = (nodeFetch as any) as typeof fetch // TODO: customize fetch with timeout
): {
  readonly getService: TypeofApiCall<typeof getServiceT>;
  readonly updateService: TypeofApiCall<typeof updateServiceT>;
  readonly uploadServiceLogo: TypeofApiCall<typeof uploadServiceLogoT>;
  readonly getServices: TypeofApiCall<typeof getServicesT>;
  readonly createService: TypeofApiCall<typeof createServiceT>;
  readonly createDevelopmentProfile: TypeofApiCall<
    typeof createDevelopmentProfileT
  >;
  readonly getSubscriptionKeys: TypeofApiCall<typeof getSubscriptionKeysT>;
  readonly regenerateSubscriptionKeys: TypeofApiCall<
    typeof regenerateSubscriptionKeysT
  >;
  readonly getUsers: TypeofApiCall<typeof getUsersT>;
  readonly createUser: TypeofApiCall<typeof createUserT>;
  readonly getUser: TypeofApiCall<typeof getUserT>;
  readonly updateGroups: TypeofApiCall<typeof updateGroupsT>;
  readonly createSubscription: TypeofApiCall<typeof createSubscriptionT>;
  readonly updateUser: TypeofApiCall<typeof updateUserT>;
} {
  const options = {
    baseUrl,
    fetchApi
  };

  const tokenHeaderProducer = SubscriptionKeyHeaderProducer(token);

  // Custom decoder until we fix the problem in the io-utils generator
  // https://www.pivotaltracker.com/story/show/169915207
  // tslint:disable-next-line:typedef
  function uploadServiceLogoDecoder() {
    return composeResponseDecoders(
      composeResponseDecoders(
        composeResponseDecoders(
          composeResponseDecoders(
            composeResponseDecoders(
              constantResponseDecoder<undefined, 201, "Location">(
                201,
                undefined
              ),
              ioResponseDecoder<
                400,
                typeof ProblemJson["_A"],
                typeof ProblemJson["_O"]
              >(400, ProblemJson)
            ),
            constantResponseDecoder<undefined, 401>(401, undefined)
          ),
          constantResponseDecoder<undefined, 403>(403, undefined)
        ),
        constantResponseDecoder<undefined, 404>(404, undefined)
      ),
      constantResponseDecoder<undefined, 500>(500, undefined)
    );
  }

  const getServiceT: ReplaceRequestParams<
    GetServiceT,
    Omit<RequestParams<GetServiceT>, "SubscriptionKey">
  > = {
    headers: tokenHeaderProducer,
    method: "get",
    query: _ => ({}),
    response_decoder: getServiceDefaultDecoder(),
    url: params => `/services/${params.service_id}`
  };

  const updateServiceT: ReplaceRequestParams<
    UpdateServiceT,
    Omit<RequestParams<UpdateServiceT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.service),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: updateServiceDefaultDecoder(),
    url: params => `/services/${params.service_id}`
  };

  const uploadServiceLogoT: ReplaceRequestParams<
    UploadServiceLogoT,
    Omit<RequestParams<UploadServiceLogoT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.logo),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: uploadServiceLogoDecoder(),
    url: params => `/services/${params.service_id}/logo`
  };

  const getServicesT: ReplaceRequestParams<
    GetServicesT,
    Omit<RequestParams<GetServicesT>, "SubscriptionKey">
  > = {
    headers: tokenHeaderProducer,
    method: "get",
    query: _ => ({}),
    response_decoder: getServicesDefaultDecoder(),
    url: () => `/services`
  };

  const createServiceT: ReplaceRequestParams<
    CreateServiceT,
    Omit<RequestParams<CreateServiceT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.service),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "post",
    query: _ => ({}),
    response_decoder: createServiceDefaultDecoder(),
    url: () => `/services`
  };

  const createDevelopmentProfileT: ReplaceRequestParams<
    CreateDevelopmentProfileT,
    Omit<RequestParams<CreateDevelopmentProfileT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.developmentProfile),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "post",
    query: _ => ({}),
    response_decoder: createDevelopmentProfileDefaultDecoder(),
    url: params => `/development-profiles/${params.sandboxFiscalCode}`
  };

  const getSubscriptionKeysT: ReplaceRequestParams<
    GetSubscriptionKeysT,
    Omit<RequestParams<GetSubscriptionKeysT>, "SubscriptionKey">
  > = {
    headers: tokenHeaderProducer,
    method: "get",
    query: _ => ({}),
    response_decoder: getSubscriptionKeysDefaultDecoder(),
    url: params => `/services/${params.service_id}/keys`
  };

  const regenerateSubscriptionKeysT: ReplaceRequestParams<
    RegenerateSubscriptionKeysT,
    Omit<RequestParams<RegenerateSubscriptionKeysT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.subscriptionKeyTypePayload),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: RegenerateSubscriptionKeysDefaultDecoder(),
    url: params => `/services/${params.service_id}/keys`
  };

  const getUsersT: ReplaceRequestParams<
    GetUsersT,
    Omit<RequestParams<GetUsersT>, "SubscriptionKey">
  > = {
    headers: tokenHeaderProducer,
    method: "get",
    query: params => ({ cursor: params.cursor }),
    response_decoder: getUsersDefaultDecoder(),
    url: () => `/users`
  };

  const createUserT: ReplaceRequestParams<
    CreateUserT,
    Omit<RequestParams<CreateUserT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.userPayload),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "post",
    query: _ => ({}),
    response_decoder: createUserDefaultDecoder(),
    url: () => `/users`
  };

  const updateUserT: ReplaceRequestParams<
    UpdateUserT,
    Omit<RequestParams<UpdateUserT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.userUpdatePayload),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: updateUserDefaultDecoder(),
    url: params => `/users/${params.email}`
  };

  const getUserT: ReplaceRequestParams<
    GetUserT,
    Omit<RequestParams<GetUserT>, "SubscriptionKey">
  > = {
    headers: tokenHeaderProducer,
    method: "get",
    query: _ => ({}),
    response_decoder: getUserDefaultDecoder(),
    url: params => `/users/${params.email}`
  };

  const updateGroupsT: ReplaceRequestParams<
    UpdateGroupsT,
    Omit<RequestParams<UpdateGroupsT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.userGroupsPayload),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: updateGroupsDefaultDecoder(),
    url: params => `/users/${params.email}/groups`
  };

  const createSubscriptionT: ReplaceRequestParams<
    CreateSubscriptionT,
    Omit<RequestParams<CreateSubscriptionT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.productNamePayload),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "put",
    query: _ => ({}),
    response_decoder: createSubscriptionDefaultDecoder(),
    url: params =>
      `/users/${params.email}/subscriptions/${params.subscription_id}`
  };

  return {
    createDevelopmentProfile: createFetchRequestForApi(
      createDevelopmentProfileT,
      options
    ),
    createService: createFetchRequestForApi(createServiceT, options),
    createSubscription: createFetchRequestForApi(createSubscriptionT, options),
    createUser: createFetchRequestForApi(createUserT, options),
    getService: createFetchRequestForApi(getServiceT, options),
    getServices: createFetchRequestForApi(getServicesT, options),
    getSubscriptionKeys: createFetchRequestForApi(
      getSubscriptionKeysT,
      options
    ),
    getUser: createFetchRequestForApi(getUserT, options),
    getUsers: createFetchRequestForApi(getUsersT, options),
    regenerateSubscriptionKeys: createFetchRequestForApi(
      regenerateSubscriptionKeysT,
      options
    ),
    updateGroups: createFetchRequestForApi(updateGroupsT, options),
    updateService: createFetchRequestForApi(updateServiceT, options),
    uploadServiceLogo: createFetchRequestForApi(uploadServiceLogoT, options),
    updateUser: createFetchRequestForApi(updateUserT, options)
  };
}

export type ApiClient = typeof ApiClient;
