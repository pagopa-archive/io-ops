import nodeFetch from "node-fetch";
import { Client, createClient } from "../generated/client";

export function ApiClient(
  baseUrl: string,
  token: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof fetch = nodeFetch as any as typeof fetch
): Client<"SubscriptionKey"> {
  return createClient<"SubscriptionKey">({
    baseUrl,
    fetchApi,
    withDefaults: (op) => (params) =>
      op({
        ...params,
        SubscriptionKey: token,
      }),
  });
}

export type ApiClient = typeof ApiClient;
