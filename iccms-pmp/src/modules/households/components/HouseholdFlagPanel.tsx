import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/core/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { programConfig } from "@/config";
import { ErrorState } from "@/platform/data-table/states";

import {
  createHouseholdFlag,
  fetchHouseholdFlags,
  householdFlagsKey,
  resolveHouseholdFlag,
} from "../api/extended";

type Props = {
  householdId: string;
  scopeKey: string;
  verifier: string;
};

function displayDate(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.slice(0, 10) : "—";
}

export function HouseholdFlagPanel({ householdId, scopeKey, verifier }: Props): ReactNode {
  const { state } = useAuth();
  const canResolve =
    state.status === "authenticated" && state.access.permissions.has("flags.resolve");
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const queryKey = householdFlagsKey(scopeKey, householdId);
  const flagsQuery = useQuery({
    queryKey,
    queryFn: () => fetchHouseholdFlags(householdId),
    staleTime: 60_000,
    meta: { persist: false },
  });
  const refreshFlags = () => queryClient.invalidateQueries({ queryKey });
  const createMutation = useMutation({
    mutationFn: () =>
      createHouseholdFlag({
        household_id: householdId,
        comment: comment.trim(),
        category,
        severity,
        verifier,
        status: "pending",
      }),
    onSuccess: async () => {
      setComment("");
      setCategory("");
      setSeverity("");
      setFormError(null);
      await refreshFlags();
      setActionMessage("Flag submitted successfully.");
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Flag submission failed."),
  });
  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveHouseholdFlag(id),
    onSuccess: async () => {
      await refreshFlags();
      setActionMessage("Flag resolved.");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment.trim().length < 10) {
      setFormError("Flag observations must be at least 10 characters long.");
      return;
    }
    setFormError(null);
    createMutation.mutate();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Flag history</h2>
        {actionMessage ? (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            {actionMessage}
          </p>
        ) : null}
        {resolveMutation.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {resolveMutation.error instanceof Error
              ? resolveMutation.error.message
              : "Could not resolve flag."}
          </p>
        ) : null}
        {flagsQuery.error ? (
          <ErrorState error={flagsQuery.error} onRetry={() => void flagsQuery.refetch()} />
        ) : null}
        {flagsQuery.isLoading ? (
          <p className="py-4 text-sm text-slate-500">Loading flags…</p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {(flagsQuery.data ?? []).map((flag) => (
            <article key={flag.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex justify-between gap-2">
                <strong className="text-sm">
                  {flag.category || "Flag"} · {flag.severity || "Unspecified"}
                </strong>
                <span className="text-xs">{flag.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{flag.comment}</p>
              <time className="mt-2 block text-xs text-slate-500">
                {displayDate(flag.created_on)}
              </time>
              {canResolve && flag.status !== "resolved" ? (
                <button
                  type="button"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate(flag.id)}
                  className="mt-2 rounded border px-2 py-1 text-xs disabled:opacity-50"
                >
                  Resolve
                </button>
              ) : null}
            </article>
          ))}
        </div>
        {!flagsQuery.isLoading && !flagsQuery.error && (flagsQuery.data?.length ?? 0) === 0 ? (
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
        {formError ? (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createMutation.isPending ? "Submitting…" : "Submit flag record"}
        </button>
      </form>
    </div>
  );
}
