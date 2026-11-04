import { siteConfig } from "@/config";

import { FullPageMessage } from "./FullPageMessage";

export function LoadingScreen() {
  return (
    <FullPageMessage title={siteConfig.appName}>
      <p>Loading…</p>
    </FullPageMessage>
  );
}
