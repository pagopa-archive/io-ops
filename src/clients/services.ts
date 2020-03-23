import {
  ApiHeaderJson,
  composeHeaderProducers,
  createFetchRequestForApi,
  ReplaceRequestParams,
  RequestHeaderProducer,
  RequestParams,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";
import { Omit } from "italia-ts-commons/lib/types";
import nodeFetch from "node-fetch";

import {
  submitMessageforUserDefaultDecoder,
  SubmitMessageforUserT
} from "../generated/services/requestTypes";

function SubscriptionKeyHeaderProducer<P>(
  token: string
): RequestHeaderProducer<P, "Ocp-Apim-Subscription-Key"> {
  return () => ({
    "Ocp-Apim-Subscription-Key": token
  });
}

export function ApiClient(
  baseUrl: string,
  token: string,
  // tslint:disable-next-line:no-any
  fetchApi: typeof fetch = (nodeFetch as any) as typeof fetch // TODO: customize fetch with timeout
): {
  readonly submitMessageforUser: TypeofApiCall<typeof submitMessageforUserT>;
} {
  const options = {
    baseUrl,
    fetchApi
  };

  const tokenHeaderProducer = SubscriptionKeyHeaderProducer(token);

  const submitMessageforUserT: ReplaceRequestParams<
    SubmitMessageforUserT,
    Omit<RequestParams<SubmitMessageforUserT>, "SubscriptionKey">
  > = {
    body: params => JSON.stringify(params.newMessage),
    headers: composeHeaderProducers(tokenHeaderProducer, ApiHeaderJson),
    method: "post",
    query: _ => ({}),
    response_decoder: submitMessageforUserDefaultDecoder(),
    url: params => `/services/${params.fiscalCode}`
  };

  return {
    submitMessageforUser: createFetchRequestForApi(
      submitMessageforUserT,
      options
    )
  };
}

export type ApiClient = typeof ApiClient;
