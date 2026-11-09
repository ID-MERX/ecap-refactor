/** Public surface for VCA domain types and canonical routes. */
export type { Vca } from "./api/schemas";
export { normalizeVca } from "./api/schemas";

export const vcaPaths = {
  register: () => "/vcas",
  archived: () => "/vcas/archived",
  risk: () => "/vcas/risk",
  profile: (vcaId: string) => `/vcas/${encodeURIComponent(vcaId)}`,
} as const;

export { vcasManifest } from "./manifest";
