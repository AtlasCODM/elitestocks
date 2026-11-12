import { createServerFn } from "@tanstack/react-start";
import type { PublicRuntimeConfiguration } from "./app-config";

/**
 * Public configuration is deliberately allowlisted. The handler imports the server config only
 * at request time so this module remains safe to reference from browser code.
 */
export const getPublicRuntimeConfiguration = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRuntimeConfiguration> => {
    const { getPublicRuntimeConfiguration: readConfiguration } = await import("./config.server");
    return readConfiguration();
  },
);
