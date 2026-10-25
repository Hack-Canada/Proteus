import type { Metadata } from "next";

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import TravelCharts from "@/components/reimbursements/TravelCharts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bandTotals,
  bucketTotals,
  getReimbursementStats,
  getTravelRows,
  placesByBand,
  type PlaceGroup,
  type TravelRow,
} from "@/data/reimbursements";
import { cad, formatKm } from "@/lib/travel";
import { isAdmin } from "@/lib/utils";
import { ChevronRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Reimbursements" };

function pct(part: number, whole: number) {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function ReimbursementsPage() {
  // #region agent log
  const pageStarted = Date.now();
  // #endregion
  const user = await getCurrentUser();
  // #region agent log
  const authMs = Date.now() - pageStarted;
  // #endregion
  if (!user?.id || !isAdmin(user.role)) redirect("/");

  const [stats, rows] = await Promise.all([getReimbursementStats(), getTravelRows()]);
  // #region agent log
  fetch("http://127.0.0.1:7416/ingest/d6da3325-2e0f-40ba-870a-ac5d82dcc36a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f3da0c" },
    body: JSON.stringify({
      sessionId: "f3da0c",
      runId: "post-fix-3",
      hypothesisId: "H5",
      location: "reimbursements/page.tsx",
      message: "reimbursements page data ready",
      data: { authMs, totalMs: Date.now() - pageStarted, rows: rows.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const regions = bandTotals(rows);
  const buckets = bucketTotals(rows);
  const bands = placesByBand(rows);
  const notAccepted = stats.approved - stats.approvedAccepted;

  return (
    <Container className="space-y-6 md:space-y-10">
      <PageBanner
        heading="Reimbursements"
        subheading="Travel requests, where people are coming from, and who has been approved."
      />
      {stats.pending > 0 ? (
        <Button asChild>
          <Link href="/reimbursements/review">Start review ({stats.pending} pending)</Link>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">All travel requests have a decision.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Requested"
          value={cad(stats.requestedTotal)}
          detail={`${stats.requested} people · ${stats.team} on a team, ${stats.solo} solo`}
        />
        <Metric
          label="Approved"
          value={cad(stats.approvedTotal)}
          detail={`${stats.approved} approved · ${stats.rejected} rejected`}
        />
        <Metric
          label="Pending"
          value={stats.pending}
          detail={
            stats.reviewed > 0
              ? `${pct(stats.approved, stats.reviewed)} of reviewed approved`
              : "Nothing reviewed yet"
          }
        />
        <Metric
          label="Approved follow-through"
          value={`${stats.approvedRsvp} RSVP'd`}
          detail={`${stats.approvedCheckedIn} checked in · ${pct(stats.approvedRsvp, stats.approved)} of approved RSVP'd, ${pct(stats.approvedCheckedIn, stats.approved)} checked in`}
        />
      </div>

      {notAccepted > 0 && (
        <p className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {notAccepted} approved for travel {notAccepted === 1 ? "does" : "do"} not have an
          accepted application yet. That is expected if reimbursement review happens first.
        </p>
      )}

      <TravelCharts regions={regions} buckets={buckets} />

      <section className="rounded-3xl border p-5 dark:border-white/[0.06]">
        <h2 className="mb-4 font-display text-2xl">Where people are travelling from</h2>

        {bands.length === 0 && (
          <p className="text-sm text-muted-foreground">No travel requests yet.</p>
        )}

        <div className="space-y-6">
          {bands.map((group) => (
            <div key={group.band.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span>
                  {group.band.label}
                  {group.band.label !== "Unknown" && ` · ${group.band.range}`}
                </span>
                <span className="tabular-nums normal-case tracking-normal">
                  {group.people} {group.people === 1 ? "person" : "people"} · {cad(group.asked)}
                </span>
              </div>
              <ul className="divide-y rounded-2xl border dark:divide-white/[0.06] dark:border-white/[0.06]">
                {group.places.map((place) => (
                  <PlaceRow key={place.key} place={place} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Distance</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead>Application</TableHead>
            <TableHead>RSVP</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.userId}>
              <TableCell>
                <Link
                  href={`/applications/${row.userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                {row.teamId ? (
                  <Link href={`/teams/${row.teamId}`} className="underline-offset-4 hover:underline">
                    {row.teamName}
                  </Link>
                ) : (
                  "Solo"
                )}
              </TableCell>
              <TableCell title={row.travelFrom ?? undefined}>
                {row.place?.label ?? row.travelFrom ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatKm(row.place?.km ?? null)}
                <span className="block text-xs text-muted-foreground">{row.band}</span>
              </TableCell>
              <TableCell>{cad(row.requested)}</TableCell>
              <TableCell className="capitalize">{row.decision ?? "Pending"}</TableCell>
              <TableCell>
                {row.decision === "approved" && row.approvedAmount != null
                  ? cad(row.approvedAmount)
                  : "—"}
              </TableCell>
              <TableCell className="capitalize">
                {row.applicationStatus.replaceAll("_", " ")}
              </TableCell>
              <TableCell>{row.rsvp ? "Yes" : "No"}</TableCell>
              <TableCell>{row.checkedIn ? "Yes" : "No"}</TableCell>
              <TableCell>
                <Link
                  href={`/reimbursements/review?userId=${row.userId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {row.decision ? "Edit" : "Review"}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
}

function PlaceRow({ place }: { place: PlaceGroup }) {
  const [city, ...rest] = place.label.split(", ");
  const teamCount = place.rows.filter((row) => row.teamId).length;
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{city}</span>
            {rest.length > 0 && (
              <span className="text-sm text-muted-foreground">, {rest.join(", ")}</span>
            )}
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {formatKm(place.km)}
          </span>
          <span className="flex w-20 items-center justify-end gap-1 text-sm text-muted-foreground">
            {teamCount > 0 && <UsersRound className="size-3.5" aria-label="Includes team members" />}
            {place.rows.length}
          </span>
          <span className="w-16 text-right text-sm font-medium tabular-nums">
            {cad(place.asked)}
          </span>
        </summary>
        <ul className="space-y-1 px-4 pb-3 pl-11">
          {place.rows.map((row) => (
            <li key={row.userId}>
              <Link
                href={`/reimbursements/review?userId=${row.userId}`}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                {row.teamName && (
                  <span className="hidden max-w-40 truncate rounded-full bg-muted px-2 py-0.5 text-xs sm:inline">
                    {row.teamName}
                  </span>
                )}
                <DecisionBadge row={row} />
                <span className="w-12 text-right tabular-nums text-muted-foreground">
                  {cad(row.requested)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function DecisionBadge({ row }: { row: TravelRow }) {
  if (row.decision === "approved") {
    return (
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
        Approved {row.approvedAmount != null ? cad(row.approvedAmount) : ""}
      </span>
    );
  }
  if (row.decision === "rejected") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Rejected
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Pending</span>;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border px-4 py-5 dark:border-white/[0.06]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
