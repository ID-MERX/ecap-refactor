import { Link } from "react-router";

import { FullPageMessage } from "./FullPageMessage";

export function NotFoundScreen() {
  return (
    <FullPageMessage
      title="Page not found"
      action={
        <Link
          className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          to="/"
        >
          Back to the dashboard
        </Link>
      }
    />
  );
}
