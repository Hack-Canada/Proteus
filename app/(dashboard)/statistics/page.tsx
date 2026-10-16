import type { Metadata } from "next";

export const metadata: Metadata = { title: "Statistics" };

import { getCurrentUser } from "@/auth";
import HackerPieChart from "@/components/Charts/HackerPieChart";
import LevelOfStudyData from "@/components/Charts/LevelOfStudy/LevelOfStudyData";
import ApplicationTypeData from "@/components/Charts/ApplicationType/ApplicationTypeData";
import ReviewPipelineStats from "@/components/Charts/ReviewPipeline/ReviewPipelineStats";
import ReviewerAnalytics from "@/components/Charts/ReviewerAnalytics";
import SchoolData from "@/components/Charts/School/SchoolData";
import TShirtData from "@/components/Charts/TShirt/TShirtData";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import { db } from "@/lib/db";
import {
  hackerApplications,
  users,
  applicationReviews,
} from "@/lib/db/schema";
import { and, count, eq, sql, isNotNull } from "drizzle-orm";
import { REVIEWS_PER_APP } from "@/lib/constants";
import { getFunnel, getTeamStats, getTopCountries, getTravelStats } from "@/data/stats";
import { trackLabel } from "@/config/apply";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { getReviewerAnalytics } from "@/lib/normalization/normalize";

export const revalidate = 120;

const StatisticsPage = async () => {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "organizer")) {
    redirect("https://app.hackcanada.org");
  }

  const [
    [applications],
    funnel,
    teamStats,
    countries,
    topSchools,
    trackBreakdown,
    ratingBySchool,
    levelVsAcceptance,
    reviewCoverage,
    reviewProgressData,
    ratingHistogramData,
    [reviewSpeedData],
    reviewerAgreementData,
    travelRequests,
    reviewerAnalytics,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(hackerApplications)
      .where(eq(hackerApplications.submissionStatus, "submitted")),
    getFunnel(),
    getTeamStats(),
    getTopCountries(8),
    db
      .select({
        school: hackerApplications.school,
        applicants: sql<number>`COUNT(${hackerApplications.userId})`,
      })
      .from(hackerApplications)
      .where(
        and(
          eq(hackerApplications.submissionStatus, "submitted"),
          isNotNull(hackerApplications.school),
        ),
      )
      .groupBy(hackerApplications.school)
      .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`)
      .limit(1),
    db
      .select({
        applicationType: hackerApplications.applicationType,
        applicants: sql<number>`COUNT(${hackerApplications.userId})`,
      })
      .from(hackerApplications)
      .where(eq(hackerApplications.submissionStatus, "submitted"))
      .groupBy(hackerApplications.applicationType)
      .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`),
    db
      .select({
        school: hackerApplications.school,
        avgRating: sql<number>`ROUND(AVG(${hackerApplications.averageRating})::numeric / 100, 2)`,
        appCount: sql<number>`COUNT(${hackerApplications.userId})`,
      })
      .from(hackerApplications)
      .where(
        and(
          eq(hackerApplications.submissionStatus, "submitted"),
          isNotNull(hackerApplications.averageRating),
        ),
      )
      .groupBy(hackerApplications.school)
      .orderBy(sql`AVG(${hackerApplications.averageRating}) DESC`)
      .limit(5),
    db
      .select({
        level: hackerApplications.levelOfStudy,
        total: sql<number>`COUNT(${hackerApplications.userId})`,
        accepted: sql<number>`COUNT(CASE WHEN ${users.applicationStatus} = 'accepted' THEN 1 END)`,
      })
      .from(hackerApplications)
      .innerJoin(users, eq(hackerApplications.userId, users.id))
      .where(
        and(
          eq(hackerApplications.submissionStatus, "submitted"),
          isNotNull(hackerApplications.levelOfStudy),
        ),
      )
      .groupBy(hackerApplications.levelOfStudy)
      .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`),
    db
      .select({
        total: sql<number>`COUNT(${hackerApplications.id})`,
        reviewed: sql<number>`COUNT(CASE WHEN ${hackerApplications.reviewCount} >= ${REVIEWS_PER_APP} THEN 1 END)`,
        unreviewed: sql<number>`COUNT(CASE WHEN ${hackerApplications.reviewCount} < ${REVIEWS_PER_APP} THEN 1 END)`,
      })
      .from(hackerApplications)
      .where(eq(hackerApplications.submissionStatus, "submitted")),
    // Review progress distribution (how many apps have 0, 1, 2, ... 5 reviews)
    db
      .select({
        reviewCount: hackerApplications.reviewCount,
        count: sql<number>`COUNT(*)`,
      })
      .from(hackerApplications)
      .where(eq(hackerApplications.submissionStatus, "submitted"))
      .groupBy(hackerApplications.reviewCount)
      .orderBy(hackerApplications.reviewCount),
    // Rating histogram (distribution of individual review ratings 0-10)
    db
      .select({
        rating: applicationReviews.rating,
        count: sql<number>`COUNT(*)`,
      })
      .from(applicationReviews)
      .groupBy(applicationReviews.rating)
      .orderBy(applicationReviews.rating),
    // Review speed stats
    db
      .select({
        median: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${applicationReviews.reviewDuration})`,
        average: sql<number>`ROUND(AVG(${applicationReviews.reviewDuration})::numeric, 1)`,
        min: sql<number>`MIN(${applicationReviews.reviewDuration})`,
        max: sql<number>`MAX(${applicationReviews.reviewDuration})`,
        total: sql<number>`COUNT(*)`,
        speedClickers: sql<number>`COUNT(CASE WHEN ${applicationReviews.reviewDuration} < 10 THEN 1 END)`,
      })
      .from(applicationReviews)
      .where(isNotNull(applicationReviews.reviewDuration)),
    // Reviewer agreement (rating spread per application for apps with 2+ reviews)
    db
      .select({
        spread: sql<number>`MAX(${applicationReviews.rating}) - MIN(${applicationReviews.rating})`,
      })
      .from(applicationReviews)
      .groupBy(applicationReviews.applicationId)
      .having(sql`COUNT(*) >= 2`),
    getTravelStats(),
    // Reviewer analytics (bias, reliability, etc.)
    getReviewerAnalytics(),
  ]);

  const applicationData = [
    {
      status: "pending",
      applicants: funnel.pending,
      fill: "var(--color-pending)",
    },
    {
      status: "accepted",
      applicants: funnel.accepted,
      fill: "var(--color-accepted)",
    },
    {
      status: "rejected",
      applicants: funnel.rejected,
      fill: "var(--color-rejected)",
    },
    {
      status: "waitlisted",
      applicants: funnel.waitlisted,
      fill: "var(--color-waitlisted)",
    },
  ];

  const topSchool = topSchools[0];
  const coverage = reviewCoverage[0];
  const coveragePct =
    coverage && coverage.total > 0
      ? ((coverage.reviewed / coverage.total) * 100).toFixed(1)
      : "0";
  const rsvpRateVal = funnel.rsvpRate.toFixed(1);
  const checkInRateVal = funnel.checkInRate.toFixed(1);

  return (
    <Container>
      <PageBanner
        heading="Statistics"
        subheading="Applicant demographics and cross-data insights."
        className="mb-6 md:mb-8"
      />

      <div className="flex flex-col gap-8">
        {/* Cross-Data Insights */}
        <section>
          <p className="mb-3 text-lg font-bold text-foreground md:text-xl">
            Insights
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Review Coverage */}
            <div className="rounded-lg border p-5">
              <p className="mb-2 text-sm font-semibold text-foreground">
                Review Coverage
              </p>
              {coverage && (
                <>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {coveragePct}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      of submitted apps have {REVIEWS_PER_APP} reviews
                    </span>
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${coveragePct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{coverage.reviewed} complete</span>
                    <span>{coverage.unreviewed} still short</span>
                  </div>
                </>
              )}
            </div>

            {/* RSVP Conversion */}
            <div className="rounded-lg border p-5">
              <p className="mb-2 text-sm font-semibold text-foreground">
                RSVP Conversion
              </p>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {rsvpRateVal}%
                </span>
                <span className="text-xs text-muted-foreground">
                  of accepted applicants RSVP&apos;d
                </span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${rsvpRateVal}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{funnel.rsvp} RSVPs</span>
                <span>{funnel.accepted} accepted</span>
              </div>
            </div>

            <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
              <p className="mb-2 text-sm font-semibold text-foreground">Check-in rate</p>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{checkInRateVal}%</span>
                <span className="text-xs text-muted-foreground">of RSVPs checked in</span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${checkInRateVal}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{funnel.checkedIn} checked in</p>
            </div>

            <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
              <p className="mb-2 text-sm font-semibold text-foreground">Teams</p>
              <p className="text-2xl font-bold text-foreground">{teamStats.teams}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg size {teamStats.averageSize.toFixed(1)} · {teamStats.fullTeams} full (4)
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {teamStats.teamApplicants} team applicants · {teamStats.soloApplicants} solo
              </p>
            </div>

            <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
              <p className="mb-3 text-sm font-semibold text-foreground">Top countries</p>
              <div className="space-y-2">
                {countries.map(({ country, applicants }) => {
                  const width =
                    countries[0]?.applicants > 0
                      ? Math.round((applicants / countries[0].applicants) * 100)
                      : 0;
                  return (
                    <div key={country} className="flex items-center gap-3 text-sm">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                      </div>
                      <span className="flex-1 truncate">{country}</span>
                      <span className="tabular-nums">{applicants}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Tracks and travel
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Top School</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {topSchool?.school ?? "N/A"}
                  </p>
                  {topSchool && (
                    <p className="text-xs text-muted-foreground">
                      {topSchool.applicants} applicants (
                      {(
                        (topSchool.applicants / applications.count) *
                        100
                      ).toFixed(1)}
                      %)
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  {trackBreakdown.map(({ applicationType, applicants: n }) => (
                    <div
                      key={applicationType ?? "none"}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{trackLabel(applicationType)}</span>
                      <span className="font-medium tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Travel reimbursement
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {travelRequests.count} requests · $
                    {travelRequests.total.toLocaleString("en-CA")}
                  </p>
                </div>
              </div>
            </div>

            {/* Acceptance Rate by Level of Study */}
            <div className="rounded-lg border p-5 sm:col-span-2 lg:col-span-1">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Acceptance Rate by Study Level
              </p>
              <div className="space-y-2">
                {levelVsAcceptance.slice(0, 6).map(({ level, total, accepted }) => {
                  const rate =
                    total > 0 ? ((accepted / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="flex-1 truncate text-xs">
                        {level || "Not specified"}
                      </span>
                      <span className="text-xs font-medium tabular-nums">
                        {rate}%
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ({accepted}/{total})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Rated Schools */}
            <div className="rounded-lg border p-5 sm:col-span-2">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Highest Rated Schools (avg applicant rating)
              </p>
              <div className="space-y-2">
                {ratingBySchool.map(({ school, avgRating, appCount }, i) => (
                  <div
                    key={school}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 text-xs font-medium text-muted-foreground">
                        {i + 1}.
                      </span>
                      <span className="truncate">
                        {school || "Not specified"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {appCount} apps
                      </span>
                      <span className="font-medium tabular-nums">
                        {avgRating}/10
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Review Pipeline */}
        <section>
          <p className="mb-3 text-lg font-bold text-foreground md:text-xl">
            Review Pipeline
          </p>
          <ReviewPipelineStats
            reviewProgress={reviewProgressData}
            ratingHistogram={ratingHistogramData}
            reviewSpeed={reviewSpeedData}
            reviewerAgreement={reviewerAgreementData}
          />
        </section>

        {/* Reviewer Analytics */}
        <section>
          <p className="mb-3 text-lg font-bold text-foreground md:text-xl">
            Reviewer Analytics
          </p>
          <ReviewerAnalytics
            reviewers={reviewerAnalytics.reviewers}
            globalAvg={reviewerAnalytics.globalAvg}
            globalStdDev={reviewerAnalytics.globalStdDev}
            harshestReviewer={reviewerAnalytics.harshestReviewer}
            mostLenientReviewer={reviewerAnalytics.mostLenientReviewer}
            avgBias={reviewerAnalytics.avgBias}
            agreementRate={reviewerAnalytics.agreementRate}
          />
        </section>

        {/* Charts Grid */}
        <section>
          <p className="mb-3 text-lg font-bold text-foreground md:text-xl">
            Detailed Breakdowns
          </p>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-8 md:col-span-2">
              <SchoolData />
              <ApplicationTypeData />
              <LevelOfStudyData />
            </div>
            <div className="col-span-2 grid h-fit gap-8 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
              <HackerPieChart
                applicantsCount={applications.count}
                data={applicationData}
              />
              <TShirtData />
            </div>
          </div>
        </section>
      </div>
    </Container>
  );
};

export default StatisticsPage;
