"use client";

import { useActionState, useState } from "react";

import {
  saveTravelDecisions,
  type SaveTravelState,
} from "@/app/(dashboard)/reimbursements/actions";
import { Button } from "@/components/ui/button";
import type { TravelCaseMember } from "@/data/reimbursements";
import { TRAVEL_CAP, bandOf, cad, formatKm } from "@/lib/travel";

type RowState = {
  userId: string;
  name: string;
  requested: number;
  decision: "" | "approved" | "rejected";
  amount: string;
  applicationStatus: string;
  requestedChanged: boolean;
  approvedAmount: number | null;
  from: string;
};

function fromLine(person: TravelCaseMember) {
  if (!person.place) return `From ${person.application?.travelFrom?.trim() || "—"}`;
  return `From ${person.place.label} · ${formatKm(person.place.km)} away (${bandOf(person.place.km)})`;
}

function initialRows(people: TravelCaseMember[]): RowState[] {
  return people.map((person) => ({
    userId: person.userId,
    name: person.name,
    requested: person.requested,
    decision: person.decision ?? "",
    amount: String(person.approvedAmount ?? person.requested),
    applicationStatus: person.applicationStatus,
    requestedChanged: person.requestedChanged,
    approvedAmount: person.approvedAmount,
    from: fromLine(person),
  }));
}

export default function TravelReviewForm({
  people,
  focusUserId,
}: {
  people: TravelCaseMember[];
  focusUserId: string;
}) {
  const [rows, setRows] = useState(() => initialRows(people));
  const [state, action, pending] = useActionState<SaveTravelState, FormData>(
    saveTravelDecisions,
    null,
  );

  function update(userId: string, patch: Partial<RowState>) {
    setRows((current) =>
      current.map((row) => (row.userId === userId ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-3xl border p-5 dark:border-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Decision</h2>
          <p className="text-sm text-muted-foreground">
            Yes keeps the amount, which starts at what they asked for. No clears it.
          </p>
        </div>
        {rows.length > 1 && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((current) =>
                  current.map((row) => ({ ...row, decision: "approved" })),
                )
              }
            >
              Approve all
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((current) =>
                  current.map((row) => ({ ...row, decision: "rejected" })),
                )
              }
            >
              Reject all
            </Button>
          </div>
        )}
      </div>

      <input type="hidden" name="focusUserId" value={focusUserId} />

      <div className="space-y-3">
        {rows.map((row) => (
          <fieldset
            key={row.userId}
            className="rounded-2xl border px-4 py-3 dark:border-white/[0.06]"
          >
            <legend className="px-1 text-sm font-medium">{row.name}</legend>
            <input type="hidden" name="userId" value={row.userId} />
            <input type="hidden" name="decision" value={row.decision} />
            <input
              type="hidden"
              name="amount"
              value={row.decision === "rejected" ? "" : row.amount}
            />
            <p className="text-xs text-muted-foreground">
              Asked for {cad(row.requested)} · application {row.applicationStatus.replaceAll("_", " ")}
            </p>
            <p className="text-xs text-muted-foreground">{row.from}</p>
            {row.requestedChanged && row.approvedAmount != null && (
              <p className="mt-1 text-xs text-primary">
                Requested changed. Approved amount on file is {cad(row.approvedAmount)}.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={row.decision === "approved" ? "default" : "outline"}
                  onClick={() => update(row.userId, { decision: "approved" })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={row.decision === "rejected" ? "default" : "outline"}
                  onClick={() => update(row.userId, { decision: "rejected" })}
                >
                  No
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                Approved CAD
                <input
                  inputMode="numeric"
                  disabled={row.decision === "rejected"}
                  value={row.amount}
                  onChange={(event) =>
                    update(row.userId, {
                      amount: event.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="h-10 w-24 rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
                  aria-label={`Approved amount for ${row.name}`}
                />
                <span className="text-xs text-muted-foreground">up to {TRAVEL_CAP}</span>
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="stay" variant="outline" disabled={pending}>
          Save
        </Button>
        <Button type="submit" name="intent" value="continue" disabled={pending}>
          Save & continue
        </Button>
      </div>
    </form>
  );
}
