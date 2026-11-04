import { Link } from "react-router";

import { FullPageMessage } from "./FullPageMessage";

export function ForbiddenScreen() {
  return (
    <FullPageMessage
      title="You do not have access to this page"
      action={
        <Link
          className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          to="/"
        >
          Back to the dashboard
        </Link>
      }
    >
      <p>If you think this is a mistake, contact your administrator.</p>
    </FullPageMessage>
  );
}
