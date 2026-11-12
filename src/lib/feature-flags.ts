import { getAppConfig, subscribeToAppConfig } from "./app-config";

export const featureFlags = {
  inAppSupport: getAppConfig().inAppSupport,
};

subscribeToAppConfig((configuration) => {
  featureFlags.inAppSupport = configuration.inAppSupport;
});
