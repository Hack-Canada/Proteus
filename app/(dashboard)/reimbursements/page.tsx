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
  bucketTotals,
  cad,
  getReimbursementStats,
  getTravelRows,
  regionTotals,
  topCities,
} from "@/data/reimbursements";
import { isAdmin } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Reimbursements" };

function pct(part: number, whole: number) {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function ReimbursementsPage() {
  const user = await getCurrentUser();
  if (!user?.id || !isAdmin(user.role)) redirect("/");

  const [stats, rows] = await Promise.all([getReimbursementStats(), getTravelRows()]);
  const regions = regionTotals(rows);
  const buckets = bucketTotals(rows);
  const cities = topCities(rows);
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
        <h2 className="font-display text-2xl">Top cities</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Same place, different spelling, counted together.
        </p>
        {cities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submitted travel requests.</p>
        ) : (
          <ol className="space-y-2">
            {cities.map((city) => (
              <li key={city.city} className="flex items-center justify-between gap-3 text-sm">
                <span>{city.city}</span>
                <span className="tabular-nums text-muted-foreground">
                  {city.count} · {cad(city.total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Region</TableHead>
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
              <TableCell title={row.travelFrom ?? undefined}>{row.city}</TableCell>
              <TableCell>{row.region}</TableCell>
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
