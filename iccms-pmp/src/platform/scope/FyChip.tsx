/**
 * The FY selector in the header.
 *
 * Shows the resolved label (`FY2027`, `All time`, `Custom: …`) and offers the current FY plus the two
 * before it, all-time, and a custom range. Matches the legacy chip's placement and vocabulary, but the
 * label comes from `resolveFy` rather than being assembled in three places.
 */

import { useState } from "react";

import { useFy } from "./FyProvider";
import { recentFys } from "./fy";

export function FyChip() {
  const { state, window, setState } = useFy();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(state.mode === "custom" ? state.from : "");
  const [to, setTo] = useState(state.mode === "custom" ? state.to : "");

  const options = recentFys();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
      >
        {window.label}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((fy) => (
            <button
              key={fy}
              type="button"
              onClick={() => {
                setState({ mode: "fy", fy });
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
            >
              FY{fy}
              {fy === options[0] ? (
                <span className="ml-1 text-xs text-slate-400">current</span>
              ) : null}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setState({ mode: "all" });
              setOpen(false);
            }}
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
          >
            All time
          </button>

          <div className="mt-1 border-t border-slate-100 p-2">
            <p className="mb-1 text-xs font-medium text-slate-500">Custom range</p>
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={from}
                aria-label="Custom range start"
                onChange={(event) => setFrom(event.target.value)}
                className="rounded border border-slate-300 px-1.5 py-1 text-sm"
              />
              <input
                type="date"
                value={to}
                aria-label="Custom range end"
                onChange={(event) => setTo(event.target.value)}
                className="rounded border border-slate-300 px-1.5 py-1 text-sm"
              />
              <button
                type="button"
                disabled={!from || !to}
                onClick={() => {
                  setState({ mode: "custom", from, to });
                  setOpen(false);
                }}
                className="rounded bg-brand-600 px-2 py-1 text-sm text-white disabled:opacity-50"
              >
                Apply custom range
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
