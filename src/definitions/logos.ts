import * as t from "io-ts";

export const FallbackLogo = t.interface({
  logo: t.string,
  type: t.union([t.literal("org"), t.literal("service")])
});

export type FallbackLogo = t.TypeOf<typeof FallbackLogo>;
