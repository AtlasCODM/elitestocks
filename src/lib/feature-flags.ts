export const featureFlags = {
  inAppSupport: import.meta.env.VITE_FEATURE_IN_APP_SUPPORT === "true",
} as const;
