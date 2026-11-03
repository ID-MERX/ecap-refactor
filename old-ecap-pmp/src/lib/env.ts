const env = import.meta.env as Record<string, string | undefined>;

const pickFirstEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
};

export const getDirectusBaseUrl = () =>
  pickFirstEnv("REACT_APP_BASE_URL");

export const getBackendBaseUrl = () =>
  pickFirstEnv("REACT_PUBLIC_API_URL");
