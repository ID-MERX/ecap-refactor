import { AlertTriangle } from "lucide-react";

import { userMessage } from "@/core/api";

/** One error presentation for every data surface, so a failure never renders as "no records". */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center"
    >
      <AlertTriangle className="size-6 text-red-600" />
      <div>
        <p className="font-medium text-red-800">{userMessage(error)}</p>
        <p className="mt-1 text-sm text-red-700">This is a failure to load, not an empty result.</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
