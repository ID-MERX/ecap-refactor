import { siteConfig } from "@/config";

import { FullPageMessage } from "./FullPageMessage";

/**
 * Shown when `deriveAccess` returns `level: "none"`.
 *
 * The legacy app's alternative was a `VITE_DEFAULT_DISTRICT` fallback that silently handed the user
 * one district's data (`docs/AUDIT.md` §4.4 disagreement 5). Denying with an explanation is the only
 * safe option — and it matches what the backend already does for Superset.
 */
export function NoScopeScreen() {
  return (
    <FullPageMessage title="No data scope assigned">
      <p>
        Your account is active but no district or province has been assigned to it, so there is no
        data to show. Ask an administrator to set your <strong>location</strong> (district) or{" "}
        <strong>title</strong> (province) in your profile.
      </p>
      <p className="mt-3">
        Need help?{" "}
        <a className="underline" href={`mailto:${siteConfig.organization.supportEmail}`}>
          {siteConfig.organization.supportEmail}
        </a>
      </p>
    </FullPageMessage>
  );
}
