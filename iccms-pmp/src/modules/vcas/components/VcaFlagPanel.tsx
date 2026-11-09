import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { programConfig } from "@/config";
import { ErrorState } from "@/platform/data-table/states";

import { createVcaFlag, fetchVcaFlags, resolveVcaFlag, vcaFlagsKey } from "../api/flags";

export function VcaFlagPanel({
  scope,
  vcaId,
  flagIds,
  householdId,
  facility,
  verifier,
}: {
  scope: string;
  vcaId: string;
  flagIds: ReadonlyArray<string>;
  householdId: string | null;
  facility: string | null;
  verifier: string;
}): ReactNode {
  const client = useQueryClient();
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [comment, setComment] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const queryKey = vcaFlagsKey(scope, vcaId);
  const flags = useQuery({
    queryKey,
    queryFn: () => fetchVcaFlags(flagIds),
    staleTime: 60_000,
    meta: { persist: false },
  });
  const invalidate = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: () =>
      createVcaFlag({
        vca_id: vcaId,
        household_id: householdId,
        facility,
        comment: comment.trim(),
        category,
        severity,
        verifier,
        status: "pending",
      }),
    onSuccess: async () => {
      setCategory("");
      setSeverity("");
      setComment("");
      setErrorText(null);
      await invalidate();
      setMessage("Flag submitted successfully.");
    },
    onError: (error) =>
      setErrorText(error instanceof Error ? error.message : "Flag submission failed."),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => resolveVcaFlag(id),
    onSuccess: async () => {
      await invalidate();
      setMessage("Flag resolved.");
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment.trim().length < 10) {
      setErrorText("Flag observations must be at least 10 characters long.");
      return;
    }
    setErrorText(null);
    create.mutate();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Flag history</h2>
        {message ? (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {resolve.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {resolve.error instanceof Error ? resolve.error.message : "Could not resolve flag."}
          </p>
        ) : null}
        {flags.error ? (
          <ErrorState error={flags.error} onRetry={() => void flags.refetch()} />
        ) : null}
        {flags.isLoading ? (
          <p role="status" className="py-4 text-sm text-slate-500">
            Loading flags…
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {(flags.data ?? []).map((flag) => (
            <article key={flag.id} className="rounded-lg border p-3">
              <div className="flex justify-between gap-2">
                <strong className="text-sm">
                  {flag.category || "General"} · {flag.severity || "Normal"}
                </strong>
                <span className="text-xs">{flag.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {flag.comment || "No description provided"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {flag.verifier || "Unknown verifier"} · {flag.created_on?.slice(0, 10) ?? "—"}
              </p>
              {flag.status !== "resolved" ? (
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate(flag.id)}
                  className="mt-2 rounded border px-2 py-1 text-xs disabled:opacity-50"
                >
                  Resolve
                </button>
              ) : null}
            </article>
          ))}
        </div>
        {!flags.isLoading && !flags.error && (flags.data?.length ?? 0) === 0 ? (
          <p className="py-4 text-sm text-slate-500">No flags recorded.</p>
        ) : null}
      </section>
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 className="font-semibold">Record a new flag</h2>
        <label className="flex flex-col gap-1 text-sm">
          Flag category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded border px-2 py-2"
          >
            <option value="">Choose category (optional)</option>
            {programConfig.flagCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priority severity
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="rounded border px-2 py-2"
          >
            <option value="">Select severity (optional)</option>
            {programConfig.flagSeverities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Flag observations
          <textarea
            required
            minLength={10}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="min-h-28 rounded border px-2 py-2"
          />
        </label>
        {errorText ? (
          <p role="alert" className="text-sm text-red-700">
            {errorText}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={create.isPending}
          className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {create.isPending ? "Submitting…" : "Submit flag record"}
        </button>
        <p className="text-xs text-slate-500">
          PII is not included in flag submissions. Backend permission enforcement and notifications
          remain follow-ups.
        </p>
      </form>
    </div>
  );
}
