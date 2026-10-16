import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import DashboardCharts from "@/components/DashboardCharts";
import PageBanner from "@/components/PageBanner";
import { trackLabel } from "@/config/apply";
import {
  getApplicationsOverTime,
  getFunnel,
  getPeople,
  getReviewTrend,
  getTeamStats,
  getTopCountries,
  getTracks,
  getTravelStats,
} from "@/data/stats";
import { getEventConfig, livePhase } from "@/lib/event-config";
import type { EventConfig } from "@/lib/db/schema";
import { isReviewer } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";

// ponytail: Next reads this export statically, so it has to be a literal. Keep it equal to DASHBOARD_REVALIDATE_SECONDS.
export const revalidate = 60;

const Home = async () => {
  const user = await getCurrentUser();

  if (!user?.id || !isReviewer(user.role)) {
    redirect("/login");
  }

  const [funnel, overTime, teams, travel, people, tracks, countries, reviewTrend, config] =
    await Promise.all([
      getFunnel(),
      getApplicationsOverTime(),
      getTeamStats(),
      getTravelStats(),
      getPeople(),
      getTracks(),
      getTopCountries(5),
      getReviewTrend(),
      getEventConfig(),
    ]);

  const statusData = [
    { status: "pending", count: funnel.pending },
    { status: "accepted", count: funnel.accepted },
    { status: "rejected", count: funnel.rejected },
    { status: "waitlisted", count: funnel.waitlisted },
    { status: "cancelled", count: funnel.cancelled },
  ];

  return (
    <Container>
      <PageBanner
        heading="Overview"
        className="mb-6 md:mb-8"
        subheading="Where applications, reviews, and the event stand right now."
      />

      <div className="flex flex-col gap-8">
        {config && config !== "missing" && <PhaseBanner config={config} />}

        <section>
          <p className="mb-3 font-display text-2xl text-foreground">Funnel</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <InsightCard
              label="Drafts"
              value={funnel.draft}
              subtitle={`${share(funnel.draft, funnel.draft + funnel.submitted)} of apps`}
            />
            <InsightCard
              label="Submitted"
              value={funnel.submitted}
              subtitle={`${share(funnel.submitted, funnel.draft + funnel.submitted)} of apps`}
            />
            <InsightCard
              label="Fully reviewed"
              value={funnel.reviewed}
              subtitle={`${funnel.reviewCoverage.toFixed(0)}% of submitted`}
            />
            <InsightCard
              label="Accepted"
              value={funnel.accepted}
              subtitle={`${funnel.acceptanceRate.toFixed(0)}% of submitted`}
            />
            <InsightCard
              label="RSVPs"
              value={funnel.rsvp}
              subtitle={`${funnel.rsvpRate.toFixed(0)}% of accepted`}
            />
            <InsightCard
              label="Checked in"
              value={funnel.checkedIn}
              subtitle={`${funnel.checkInRate.toFixed(0)}% of RSVPs`}
            />
          </div>
        </section>

        <section>
          <p className="mb-3 font-display text-2xl text-foreground">Needs attention</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AttentionCard
              href="/review-applications"
              label="Under 5 reviews"
              value={funnel.needsReviews}
              detail="Submitted and still in the review queue"
            />
            <AttentionCard
              href="/review-applications/decisions"
              label="Reviewed, not decided"
              value={funnel.reviewedUndecided}
              detail="Five reviews in, status still pending"
            />
            <AttentionCard
              href="/rsvps"
              label="Accepted, no RSVP"
              value={funnel.awaitingRsvp}
              detail="Spots that still need a yes or a release"
            />
            <AttentionCard
              label="Travel requested"
              value={`$${travel.total.toLocaleString("en-CA")}`}
              detail={`${travel.count} submitted requests`}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
            <p className="mb-3 text-sm font-medium text-muted-foreground">People</p>
            <p className="font-display text-4xl">{people.total}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {Object.entries(people.byRole)
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => (
                  <li key={role} className="flex justify-between capitalize">
                    <span>{role.replaceAll("_", " ")}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Teams</p>
            <p className="font-display text-4xl">{teams.teams}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Avg size {teams.averageSize.toFixed(1)} · {teams.fullTeams} full ·{" "}
              {teams.teamApplicants} team apps, {teams.soloApplicants} solo
            </p>
          </div>
          <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Tracks</p>
            <div className="space-y-2">
              {tracks.map(({ applicationType, applicants }) => {
                const width = share(Number(applicants), funnel.submitted);
                return (
                  <div key={applicationType ?? "none"} className="flex items-center gap-3 text-sm">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width }} />
                    </div>
                    <span className="w-20 truncate">{trackLabel(applicationType)}</span>
                    <span className="w-8 text-right tabular-nums">{applicants}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <DashboardCharts
          statusData={statusData}
          reviewTrend={reviewTrend}
          applicationTrend={overTime}
          countries={countries}
        />
      </div>
    </Container>
  );
};

function PhaseBanner({ config }: { config: EventConfig }) {
  const now = new Date();
  const phase = livePhase(config, now);
  const next = (
    [
      ["Registration opens", config.registrationOpen],
      ["Registration closes", config.registrationClose],
      ["Event starts", config.eventStart],
      ["Event ends", config.eventEnd],
    ] as const
  ).find(([, date]) => date.getTime() > now.getTime());

  const countdown = next ? formatCountdown(next[1], now) : null;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border bg-card px-6 py-5 dark:border-white/[0.06]">
      <div>
        <p className="text-sm text-muted-foreground">Current phase</p>
        <p className="font-display text-3xl capitalize">{phase.replaceAll("-", " ")}</p>
      </div>
      {next && countdown && (
        <p className="text-sm text-muted-foreground">
          {next[0]} in <span className="font-medium text-foreground">{countdown}</span>
        </p>
      )}
    </div>
  );
}

function formatCountdown(target: Date, now: Date) {
  const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / 36e5));
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}

function share(part: number, whole: number) {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function InsightCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border px-3 py-5 text-center dark:border-white/[0.06]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground md:text-3xl">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function AttentionCard({
  href,
  label,
  value,
  detail,
}: {
  href?: string;
  label: string;
  value: string | number;
  detail: string;
}) {
  const body = (
    <div className="h-full rounded-3xl border p-5 transition-colors hover:bg-accent/40 dark:border-white/[0.06]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default Home;
