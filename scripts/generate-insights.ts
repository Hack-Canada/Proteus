import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import {
  users,
  hackerApplications,
  applicationReviews,
  rsvp,
  checkIns,
  challenges,
  challengesSubmitted,
  pointsTransactions,
  userBalance,
  shopItems,
  shopPurchases,
  auditLogs,
  emailCampaigns,
  schedule,
  pointsBannedUsers,
} from "@/lib/db/schema";
import { count, eq, sql, isNotNull, desc, asc, and, gt, lt, gte, ne } from "drizzle-orm";

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

function fmt(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return Number.isInteger(n) ? n.toLocaleString() : Number(n).toFixed(2);
}

function pct(num: number, den: number): string {
  if (den === 0) return "0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

function bar(fraction: number, len = 20): string {
  const filled = Math.round(fraction * len);
  return "█".repeat(filled) + "░".repeat(len - filled);
}

function tableRow(cells: string[]): string {
  return "| " + cells.join(" | ") + " |";
}

function tableHeader(headers: string[]): string {
  return tableRow(headers) + "\n" + "| " + headers.map((h) => "-".repeat(Math.max(h.length, 3))).join(" | ") + " |";
}

async function main() {
  console.log("Querying database for insights...\n");
  const lines: string[] = [];
  const w = (...s: string[]) => lines.push(...s);

  const now = new Date();
  w(
    `# Hack Canada — Hackathon Insights Report`,
    ``,
    `> Generated on **${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}** at ${now.toLocaleTimeString("en-US")}`,
    ``,
    `---`,
    ``
  );

  // ═══════════════════════════════════════════════════
  // 1. USER & ROLE BREAKDOWN
  // ═══════════════════════════════════════════════════
  console.log("  [1/10] User & role stats...");
  const [
    [totalUsers],
    roleBreakdown,
    statusBreakdown,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({
      role: users.role,
      count: count(),
    }).from(users).groupBy(users.role).orderBy(desc(count())),
    db.select({
      status: users.applicationStatus,
      count: count(),
    }).from(users).groupBy(users.applicationStatus).orderBy(desc(count())),
  ]);

  w(`## 1. Users & Roles`, ``);
  w(`**Total registered users:** ${fmt(totalUsers.count)}`, ``);
  w(tableHeader(["Role", "Count", "Share"]));
  for (const r of roleBreakdown) {
    w(tableRow([r.role, fmt(r.count), pct(r.count, totalUsers.count)]));
  }
  w(``);
  w(`### Application Status Distribution`, ``);
  w(tableHeader(["Status", "Count", "Share"]));
  for (const s of statusBreakdown) {
    w(tableRow([s.status, fmt(s.count), pct(s.count, totalUsers.count)]));
  }
  w(``);

  // ═══════════════════════════════════════════════════
  // 2. APPLICATION & DEMOGRAPHIC INSIGHTS
  // ═══════════════════════════════════════════════════
  console.log("  [2/10] Application & demographics...");
  const [
    [totalApps],
    [submittedApps],
    topSchools,
    topCountries,
    levelOfStudyBreakdown,
    ageDistribution,
    hackathonsAttendedBreakdown,
  ] = await Promise.all([
    db.select({ count: count() }).from(hackerApplications),
    db.select({ count: count() }).from(hackerApplications).where(eq(hackerApplications.submissionStatus, "submitted")),
    db.select({
      school: hackerApplications.school,
      count: count(),
    }).from(hackerApplications).where(and(isNotNull(hackerApplications.school), eq(hackerApplications.submissionStatus, "submitted"))).groupBy(hackerApplications.school).orderBy(desc(count())).limit(15),
    db.select({
      country: hackerApplications.country,
      count: count(),
    }).from(hackerApplications).where(and(isNotNull(hackerApplications.country), eq(hackerApplications.submissionStatus, "submitted"))).groupBy(hackerApplications.country).orderBy(desc(count())).limit(15),
    db.select({
      level: hackerApplications.levelOfStudy,
      count: count(),
    }).from(hackerApplications).where(and(isNotNull(hackerApplications.levelOfStudy), eq(hackerApplications.submissionStatus, "submitted"))).groupBy(hackerApplications.levelOfStudy).orderBy(desc(count())),
    db.select({
      age: hackerApplications.age,
      count: count(),
    }).from(hackerApplications).where(and(isNotNull(hackerApplications.age), eq(hackerApplications.submissionStatus, "submitted"))).groupBy(hackerApplications.age).orderBy(asc(hackerApplications.age)),
    db.select({
      hackathons: hackerApplications.hackathonsAttended,
      count: count(),
    }).from(hackerApplications).where(and(isNotNull(hackerApplications.hackathonsAttended), eq(hackerApplications.submissionStatus, "submitted"))).groupBy(hackerApplications.hackathonsAttended).orderBy(desc(count())).limit(10),
  ]);

  const [uniqueSchools] = await db.select({ count: sql<number>`COUNT(DISTINCT ${hackerApplications.school})` }).from(hackerApplications).where(isNotNull(hackerApplications.school));
  const [uniqueCountries] = await db.select({ count: sql<number>`COUNT(DISTINCT ${hackerApplications.country})` }).from(hackerApplications).where(isNotNull(hackerApplications.country));

  w(`## 2. Applications & Demographics`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total applications (including drafts) | ${fmt(totalApps.count)} |`);
  w(`| Submitted applications | ${fmt(submittedApps.count)} |`);
  w(`| Draft / incomplete | ${fmt(totalApps.count - submittedApps.count)} |`);
  w(`| Unique schools | ${fmt(uniqueSchools.count)} |`);
  w(`| Unique countries | ${fmt(uniqueCountries.count)} |`);
  w(``);

  w(`### Top 15 Schools`, ``);
  w(tableHeader(["#", "School", "Applicants", "Share"]));
  topSchools.forEach((s, i) => {
    w(tableRow([String(i + 1), s.school ?? "N/A", fmt(s.count), pct(s.count, submittedApps.count)]));
  });
  w(``);

  w(`### Top Countries`, ``);
  w(tableHeader(["#", "Country", "Applicants", "Share"]));
  topCountries.forEach((c, i) => {
    w(tableRow([String(i + 1), c.country ?? "N/A", fmt(c.count), pct(c.count, submittedApps.count)]));
  });
  w(``);

  w(`### Level of Study`, ``);
  w(tableHeader(["Level", "Count", "Share"]));
  for (const l of levelOfStudyBreakdown) {
    w(tableRow([l.level ?? "N/A", fmt(l.count), pct(l.count, submittedApps.count)]));
  }
  w(``);

  if (ageDistribution.length > 0) {
    w(`### Age Distribution`, ``);
    w(tableHeader(["Age", "Count"]));
    for (const a of ageDistribution) {
      w(tableRow([String(a.age), fmt(a.count)]));
    }
    w(``);
  }

  if (hackathonsAttendedBreakdown.length > 0) {
    w(`### Hackathons Previously Attended`, ``);
    w(tableHeader(["Response", "Count"]));
    for (const h of hackathonsAttendedBreakdown) {
      w(tableRow([h.hackathons ?? "N/A", fmt(h.count)]));
    }
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 3. REVIEW ANALYTICS
  // ═══════════════════════════════════════════════════
  console.log("  [3/10] Review analytics...");
  const [
    [totalReviews],
    [reviewAggregates],
    reviewProgressData,
    ratingHistogram,
    reviewerLeaderboard,
    reviewSpeedBuckets,
    [reviewerAgreement],
  ] = await Promise.all([
    db.select({ count: count() }).from(applicationReviews),
    db.select({
      avgRating: sql<number>`ROUND(AVG(${applicationReviews.rating})::numeric, 2)`,
      medianRating: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${applicationReviews.rating})`,
      avgDuration: sql<number>`ROUND(AVG(${applicationReviews.reviewDuration})::numeric, 1)`,
      medianDuration: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${applicationReviews.reviewDuration})`,
      minDuration: sql<number>`MIN(${applicationReviews.reviewDuration})`,
      maxDuration: sql<number>`MAX(${applicationReviews.reviewDuration})`,
      speedClickers: sql<number>`COUNT(CASE WHEN ${applicationReviews.reviewDuration} < 10 THEN 1 END)`,
    }).from(applicationReviews),
    db.select({
      reviewCount: hackerApplications.reviewCount,
      count: sql<number>`COUNT(*)`,
    }).from(hackerApplications).where(eq(hackerApplications.submissionStatus, "submitted")).groupBy(hackerApplications.reviewCount).orderBy(hackerApplications.reviewCount),
    db.select({
      rating: applicationReviews.rating,
      count: sql<number>`COUNT(*)`,
    }).from(applicationReviews).groupBy(applicationReviews.rating).orderBy(applicationReviews.rating),
    db.select({
      reviewerId: applicationReviews.reviewerId,
      name: users.name,
      count: count(),
      avgRating: sql<number>`ROUND(AVG(${applicationReviews.rating})::numeric, 2)`,
      avgDuration: sql<number>`ROUND(AVG(${applicationReviews.reviewDuration})::numeric, 1)`,
    }).from(applicationReviews).leftJoin(users, eq(users.id, applicationReviews.reviewerId)).groupBy(applicationReviews.reviewerId, users.name).orderBy(desc(count())).limit(20),
    db.select({
      bucket: sql<string>`CASE
        WHEN ${applicationReviews.reviewDuration} < 10 THEN '< 10s'
        WHEN ${applicationReviews.reviewDuration} < 30 THEN '10-30s'
        WHEN ${applicationReviews.reviewDuration} < 60 THEN '30-60s'
        WHEN ${applicationReviews.reviewDuration} < 120 THEN '1-2 min'
        WHEN ${applicationReviews.reviewDuration} < 300 THEN '2-5 min'
        ELSE '5+ min'
      END`,
      count: count(),
      sortKey: sql<number>`MIN(${applicationReviews.reviewDuration})`,
    }).from(applicationReviews).where(isNotNull(applicationReviews.reviewDuration)).groupBy(sql`CASE
        WHEN ${applicationReviews.reviewDuration} < 10 THEN '< 10s'
        WHEN ${applicationReviews.reviewDuration} < 30 THEN '10-30s'
        WHEN ${applicationReviews.reviewDuration} < 60 THEN '30-60s'
        WHEN ${applicationReviews.reviewDuration} < 120 THEN '1-2 min'
        WHEN ${applicationReviews.reviewDuration} < 300 THEN '2-5 min'
        ELSE '5+ min'
      END`).orderBy(sql`MIN(${applicationReviews.reviewDuration})`),
    db.select({
      avgSpread: sql<number>`ROUND(AVG(s.spread)::numeric, 2)`,
      maxSpread: sql<number>`MAX(s.spread)`,
      pairsCount: sql<number>`COUNT(*)`,
    }).from(
      sql`(SELECT MAX(${applicationReviews.rating}) - MIN(${applicationReviews.rating}) as spread FROM "applicationReview" GROUP BY "applicationId" HAVING COUNT(*) >= 2) s`
    ),
  ]);

  w(`## 3. Review Analytics`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total reviews | ${fmt(totalReviews.count)} |`);
  w(`| Average rating | ${fmt(reviewAggregates.avgRating)} / 10 |`);
  w(`| Median rating | ${fmt(reviewAggregates.medianRating)} / 10 |`);
  w(`| Average review time | ${fmt(reviewAggregates.avgDuration)}s |`);
  w(`| Median review time | ${fmt(reviewAggregates.medianDuration)}s |`);
  w(`| Fastest review | ${fmt(reviewAggregates.minDuration)}s |`);
  w(`| Longest review | ${fmt(reviewAggregates.maxDuration)}s |`);
  w(`| Speed-clickers (< 10s) | ${fmt(reviewAggregates.speedClickers)} |`);
  if (reviewerAgreement) {
    w(`| Avg rating spread (2+ reviews) | ${fmt(reviewerAgreement.avgSpread)} points |`);
    w(`| Max rating spread | ${fmt(reviewerAgreement.maxSpread)} points |`);
    w(`| Applications with 2+ reviews | ${fmt(reviewerAgreement.pairsCount)} |`);
  }
  w(``);

  w(`### Review Coverage (reviews per submitted app)`, ``);
  w(tableHeader(["Reviews", "Applications", "Share"]));
  for (const p of reviewProgressData) {
    w(tableRow([String(p.reviewCount), fmt(p.count), pct(p.count, submittedApps.count)]));
  }
  w(``);

  w(`### Rating Distribution`, ``);
  w(tableHeader(["Rating", "Count", ""]));
  const maxRatingCount = Math.max(...ratingHistogram.map((r) => r.count), 1);
  for (const r of ratingHistogram) {
    w(tableRow([String(r.rating), fmt(r.count), bar(r.count / maxRatingCount, 25)]));
  }
  w(``);

  w(`### Review Speed Distribution`, ``);
  w(tableHeader(["Time Bucket", "Count", "Share"]));
  for (const b of reviewSpeedBuckets) {
    w(tableRow([b.bucket, fmt(b.count), pct(b.count, totalReviews.count)]));
  }
  w(``);

  w(`### Reviewer Leaderboard (Top 20)`, ``);
  w(tableHeader(["#", "Reviewer", "Reviews", "Avg Rating", "Avg Time (s)"]));
  reviewerLeaderboard.forEach((r, i) => {
    w(tableRow([String(i + 1), r.name ?? "Unknown", fmt(r.count), fmt(r.avgRating), fmt(r.avgDuration)]));
  });
  w(``);

  // ═══════════════════════════════════════════════════
  // 4. RSVP INSIGHTS
  // ═══════════════════════════════════════════════════
  console.log("  [4/10] RSVP insights...");
  const [
    [rsvpTotal],
    [acceptedTotal],
    tshirtBreakdown,
    dietaryBreakdown,
    [mediaConsentRate],
  ] = await Promise.all([
    db.select({ count: count() }).from(rsvp),
    db.select({ count: count() }).from(users).where(eq(users.applicationStatus, "accepted")),
    db.select({
      size: rsvp.tshirtSize,
      count: count(),
    }).from(rsvp).groupBy(rsvp.tshirtSize).orderBy(desc(count())),
    db.select({
      diet: rsvp.dietaryRestrictions,
      count: count(),
    }).from(rsvp).where(isNotNull(rsvp.dietaryRestrictions)).groupBy(rsvp.dietaryRestrictions).orderBy(desc(count())).limit(15),
    db.select({
      consented: sql<number>`COUNT(CASE WHEN ${rsvp.mediaConsent} = true THEN 1 END)`,
      total: count(),
    }).from(rsvp),
  ]);

  w(`## 4. RSVP Insights`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total RSVPs | ${fmt(rsvpTotal.count)} |`);
  w(`| Accepted hackers | ${fmt(acceptedTotal.count)} |`);
  w(`| RSVP conversion rate | ${pct(rsvpTotal.count, acceptedTotal.count)} |`);
  w(`| Media consent rate | ${pct(mediaConsentRate.consented, mediaConsentRate.total)} |`);
  w(``);

  w(`### T-Shirt Size Distribution`, ``);
  w(tableHeader(["Size", "Count", "Share", ""]));
  for (const t of tshirtBreakdown) {
    const frac = rsvpTotal.count > 0 ? t.count / rsvpTotal.count : 0;
    w(tableRow([t.size ?? "N/A", fmt(t.count), pct(t.count, rsvpTotal.count), bar(frac)]));
  }
  w(``);

  if (dietaryBreakdown.length > 0) {
    w(`### Dietary Restrictions (top 15)`, ``);
    w(tableHeader(["Restriction", "Count"]));
    for (const d of dietaryBreakdown) {
      w(tableRow([d.diet ?? "None", fmt(d.count)]));
    }
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 5. CHECK-IN ANALYTICS
  // ═══════════════════════════════════════════════════
  console.log("  [5/10] Check-in analytics...");
  const [
    [totalCheckIns],
    checkInsByEvent,
    [uniqueCheckInUsers],
    checkInTimeline,
  ] = await Promise.all([
    db.select({ count: count() }).from(checkIns),
    db.select({
      event: checkIns.eventName,
      count: count(),
      uniqueUsers: sql<number>`COUNT(DISTINCT ${checkIns.userId})`,
    }).from(checkIns).groupBy(checkIns.eventName).orderBy(desc(count())),
    db.select({
      count: sql<number>`COUNT(DISTINCT ${checkIns.userId})`,
    }).from(checkIns),
    db.select({
      hour: sql<string>`TO_CHAR(${checkIns.createdAt}, 'YYYY-MM-DD HH24:00')`,
      count: count(),
    }).from(checkIns).groupBy(sql`TO_CHAR(${checkIns.createdAt}, 'YYYY-MM-DD HH24:00')`).orderBy(sql`TO_CHAR(${checkIns.createdAt}, 'YYYY-MM-DD HH24:00')`),
  ]);

  // Repeat attendees
  const repeatAttendees = await db.select({
    userId: checkIns.userId,
    name: users.name,
    events: sql<number>`COUNT(DISTINCT ${checkIns.eventName})`,
    totalScans: count(),
  }).from(checkIns).innerJoin(users, eq(users.id, checkIns.userId)).groupBy(checkIns.userId, users.name).having(sql`COUNT(DISTINCT ${checkIns.eventName}) > 1`).orderBy(desc(sql`COUNT(DISTINCT ${checkIns.eventName})`)).limit(15);

  // No-shows: RSVP'd but never checked in
  const [noShows] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(rsvp).where(
    sql`${rsvp.userId} NOT IN (SELECT ${checkIns.userId} FROM "checkIn")`
  );

  w(`## 5. Check-In Analytics`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total check-in scans | ${fmt(totalCheckIns.count)} |`);
  w(`| Unique users checked in | ${fmt(uniqueCheckInUsers.count)} |`);
  w(`| Distinct events | ${checkInsByEvent.length} |`);
  w(`| Avg scans per user | ${uniqueCheckInUsers.count > 0 ? fmt(Math.round((totalCheckIns.count / uniqueCheckInUsers.count) * 100) / 100) : "N/A"} |`);
  w(`| No-shows (RSVP'd, never checked in) | ${fmt(noShows.count)} |`);
  w(`| No-show rate | ${pct(noShows.count, rsvpTotal.count)} |`);
  w(``);

  w(`### Check-Ins by Event`, ``);
  w(tableHeader(["Event", "Total Scans", "Unique Users"]));
  for (const e of checkInsByEvent) {
    w(tableRow([e.event, fmt(e.count), fmt(e.uniqueUsers)]));
  }
  w(``);

  if (checkInTimeline.length > 0) {
    w(`### Check-In Timeline (hourly)`, ``);
    w(tableHeader(["Hour", "Scans", ""]));
    const maxHourly = Math.max(...checkInTimeline.map((c) => c.count), 1);
    for (const c of checkInTimeline) {
      w(tableRow([c.hour, fmt(c.count), bar(c.count / maxHourly, 30)]));
    }
    w(``);
  }

  if (repeatAttendees.length > 0) {
    w(`### Most Engaged Attendees (by distinct events)`, ``);
    w(tableHeader(["#", "Name", "Distinct Events", "Total Scans"]));
    repeatAttendees.forEach((r, i) => {
      w(tableRow([String(i + 1), r.name, fmt(r.events), fmt(r.totalScans)]));
    });
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 6. CHALLENGES & QR SCANS
  // ═══════════════════════════════════════════════════
  console.log("  [6/10] Challenges & QR...");
  const [
    [totalChallenges],
    [totalSubmissions],
    [uniqueChallengers],
    challengeLeaderboard,
    challengesByCategory,
    challengesByDifficulty,
    challengeCompletionRates,
    qrVsNonQr,
  ] = await Promise.all([
    db.select({ count: count() }).from(challenges),
    db.select({ count: count() }).from(challengesSubmitted),
    db.select({ count: sql<number>`COUNT(DISTINCT ${challengesSubmitted.userId})` }).from(challengesSubmitted),
    db.select({
      userId: challengesSubmitted.userId,
      name: users.name,
      completed: count(),
    }).from(challengesSubmitted).innerJoin(users, eq(users.id, challengesSubmitted.userId)).groupBy(challengesSubmitted.userId, users.name).orderBy(desc(count())).limit(15),
    db.select({
      category: challenges.category,
      totalChallenges: count(),
      completions: sql<number>`(SELECT COUNT(*) FROM "challengesSubmitted" cs WHERE cs."challengeId" = ${challenges.id})`,
    }).from(challenges).groupBy(challenges.category, challenges.id).orderBy(challenges.category),
    db.select({
      difficulty: challenges.difficulty,
      count: count(),
      completions: sql<number>`COALESCE(SUM((SELECT COUNT(*) FROM "challengesSubmitted" cs WHERE cs."challengeId" = ${challenges.id})), 0)`,
    }).from(challenges).groupBy(challenges.difficulty).orderBy(sql`CASE ${challenges.difficulty} WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END`),
    db.select({
      challengeName: challenges.name,
      category: challenges.category,
      difficulty: challenges.difficulty,
      points: challenges.points,
      completions: sql<number>`COUNT(${challengesSubmitted.id})`,
      qrCode: challenges.qrCode,
    }).from(challenges).leftJoin(challengesSubmitted, eq(challengesSubmitted.challengeId, challenges.id)).groupBy(challenges.id, challenges.name, challenges.category, challenges.difficulty, challenges.points, challenges.qrCode).orderBy(desc(sql`COUNT(${challengesSubmitted.id})`)),
    db.select({
      isQr: challenges.qrCode,
      challengeCount: sql<number>`COUNT(DISTINCT ${challenges.id})`,
      totalCompletions: sql<number>`COUNT(${challengesSubmitted.id})`,
    }).from(challenges).leftJoin(challengesSubmitted, eq(challengesSubmitted.challengeId, challenges.id)).groupBy(challenges.qrCode),
  ]);

  // Category-level aggregation
  const categoryAgg: Record<string, { challenges: number; completions: number }> = {};
  for (const c of challengesByCategory) {
    if (!categoryAgg[c.category]) categoryAgg[c.category] = { challenges: 0, completions: 0 };
    categoryAgg[c.category].challenges++;
    categoryAgg[c.category].completions += c.completions;
  }

  w(`## 6. Challenges & QR Scans`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total challenges available | ${fmt(totalChallenges.count)} |`);
  w(`| Total challenge completions | ${fmt(totalSubmissions.count)} |`);
  w(`| Unique participants | ${fmt(uniqueChallengers.count)} |`);
  w(`| Avg completions per participant | ${uniqueChallengers.count > 0 ? fmt(Math.round((totalSubmissions.count / uniqueChallengers.count) * 100) / 100) : "N/A"} |`);
  w(``);

  w(`### QR vs Non-QR Challenges`, ``);
  w(tableHeader(["Type", "Challenges", "Completions", "Avg Completions/Challenge"]));
  for (const q of qrVsNonQr) {
    const avg = q.challengeCount > 0 ? (q.totalCompletions / q.challengeCount).toFixed(1) : "0";
    w(tableRow([q.isQr ? "QR Scan" : "Manual Submit", fmt(q.challengeCount), fmt(q.totalCompletions), avg]));
  }
  w(``);

  w(`### Challenges by Category`, ``);
  w(tableHeader(["Category", "Challenges", "Total Completions", "Avg Completions"]));
  for (const [cat, data] of Object.entries(categoryAgg).sort((a, b) => b[1].completions - a[1].completions)) {
    w(tableRow([cat, fmt(data.challenges), fmt(data.completions), fmt(Math.round((data.completions / data.challenges) * 10) / 10)]));
  }
  w(``);

  w(`### Challenges by Difficulty`, ``);
  w(tableHeader(["Difficulty", "Challenges", "Total Completions", "Avg Completions"]));
  for (const d of challengesByDifficulty) {
    const avg = d.count > 0 ? (d.completions / d.count).toFixed(1) : "0";
    w(tableRow([d.difficulty, fmt(d.count), fmt(d.completions), avg]));
  }
  w(``);

  w(`### All Challenges — Completion Rates`, ``);
  w(tableHeader(["Challenge", "Category", "Difficulty", "Pts", "QR", "Completions"]));
  for (const c of challengeCompletionRates) {
    w(tableRow([c.challengeName, c.category, c.difficulty, fmt(c.points), c.qrCode ? "Yes" : "No", fmt(c.completions)]));
  }
  w(``);

  if (challengeLeaderboard.length > 0) {
    w(`### Challenge Grinder Leaderboard (Top 15)`, ``);
    w(tableHeader(["#", "Hacker", "Challenges Completed"]));
    challengeLeaderboard.forEach((c, i) => {
      w(tableRow([String(i + 1), c.name, fmt(c.completed)]));
    });
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 7. POINTS ECONOMY
  // ═══════════════════════════════════════════════════
  console.log("  [7/10] Points economy...");
  const [
    [pointsAgg],
    [totalBalanceSum],
    topEarners,
    topSpenders,
    pointsDistribution,
    [bannedCount],
  ] = await Promise.all([
    db.select({
      totalTx: count(),
      totalEarned: sql<number>`COALESCE(SUM(CASE WHEN ${pointsTransactions.points} > 0 THEN ${pointsTransactions.points} ELSE 0 END), 0)`,
      totalSpent: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${pointsTransactions.points} < 0 THEN ${pointsTransactions.points} ELSE 0 END)), 0)`,
      avgTx: sql<number>`ROUND(AVG(ABS(${pointsTransactions.points}))::numeric, 1)`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${pointsTransactions.userId})`,
    }).from(pointsTransactions),
    db.select({
      total: sql<number>`COALESCE(SUM(${userBalance.points}), 0)`,
      avgBalance: sql<number>`ROUND(AVG(${userBalance.points})::numeric, 1)`,
      medianBalance: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${userBalance.points})`,
      maxBalance: sql<number>`MAX(${userBalance.points})`,
      minBalance: sql<number>`MIN(${userBalance.points})`,
      zeroBalance: sql<number>`COUNT(CASE WHEN ${userBalance.points} = 0 THEN 1 END)`,
      totalUsers: count(),
    }).from(userBalance),
    db.select({
      userId: pointsTransactions.userId,
      name: users.name,
      earned: sql<number>`SUM(CASE WHEN ${pointsTransactions.points} > 0 THEN ${pointsTransactions.points} ELSE 0 END)`,
    }).from(pointsTransactions).innerJoin(users, eq(users.id, pointsTransactions.userId)).groupBy(pointsTransactions.userId, users.name).orderBy(desc(sql`SUM(CASE WHEN ${pointsTransactions.points} > 0 THEN ${pointsTransactions.points} ELSE 0 END)`)).limit(15),
    db.select({
      userId: pointsTransactions.userId,
      name: users.name,
      spent: sql<number>`ABS(SUM(CASE WHEN ${pointsTransactions.points} < 0 THEN ${pointsTransactions.points} ELSE 0 END))`,
    }).from(pointsTransactions).innerJoin(users, eq(users.id, pointsTransactions.userId)).groupBy(pointsTransactions.userId, users.name).having(sql`SUM(CASE WHEN ${pointsTransactions.points} < 0 THEN ${pointsTransactions.points} ELSE 0 END) < 0`).orderBy(desc(sql`ABS(SUM(CASE WHEN ${pointsTransactions.points} < 0 THEN ${pointsTransactions.points} ELSE 0 END))`)).limit(15),
    db.select({
      bucket: sql<string>`CASE
        WHEN ${userBalance.points} = 0 THEN '0'
        WHEN ${userBalance.points} BETWEEN 1 AND 50 THEN '1-50'
        WHEN ${userBalance.points} BETWEEN 51 AND 100 THEN '51-100'
        WHEN ${userBalance.points} BETWEEN 101 AND 250 THEN '101-250'
        WHEN ${userBalance.points} BETWEEN 251 AND 500 THEN '251-500'
        WHEN ${userBalance.points} BETWEEN 501 AND 1000 THEN '501-1000'
        ELSE '1000+'
      END`,
      count: count(),
      sortKey: sql<number>`MIN(${userBalance.points})`,
    }).from(userBalance).groupBy(sql`CASE
        WHEN ${userBalance.points} = 0 THEN '0'
        WHEN ${userBalance.points} BETWEEN 1 AND 50 THEN '1-50'
        WHEN ${userBalance.points} BETWEEN 51 AND 100 THEN '51-100'
        WHEN ${userBalance.points} BETWEEN 101 AND 250 THEN '101-250'
        WHEN ${userBalance.points} BETWEEN 251 AND 500 THEN '251-500'
        WHEN ${userBalance.points} BETWEEN 501 AND 1000 THEN '501-1000'
        ELSE '1000+'
      END`).orderBy(sql`MIN(${userBalance.points})`),
    db.select({ count: count() }).from(pointsBannedUsers),
  ]);

  w(`## 7. Points Economy`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total transactions | ${fmt(pointsAgg.totalTx)} |`);
  w(`| Total points earned | ${fmt(pointsAgg.totalEarned)} |`);
  w(`| Total points spent | ${fmt(pointsAgg.totalSpent)} |`);
  w(`| Net points in circulation | ${fmt(pointsAgg.totalEarned - pointsAgg.totalSpent)} |`);
  w(`| Avg transaction size | ${fmt(pointsAgg.avgTx)} pts |`);
  w(`| Unique users with transactions | ${fmt(pointsAgg.uniqueUsers)} |`);
  w(`| Avg balance per user | ${fmt(totalBalanceSum.avgBalance)} pts |`);
  w(`| Median balance | ${fmt(totalBalanceSum.medianBalance)} pts |`);
  w(`| Max balance | ${fmt(totalBalanceSum.maxBalance)} pts |`);
  w(`| Min balance | ${fmt(totalBalanceSum.minBalance)} pts |`);
  w(`| Users with 0 balance | ${fmt(totalBalanceSum.zeroBalance)} / ${fmt(totalBalanceSum.totalUsers)} |`);
  w(`| Banned users | ${fmt(bannedCount.count)} |`);
  w(``);

  w(`### Balance Distribution`, ``);
  w(tableHeader(["Points Range", "Users", ""]));
  const maxBucket = Math.max(...pointsDistribution.map((p) => p.count), 1);
  for (const p of pointsDistribution) {
    w(tableRow([p.bucket, fmt(p.count), bar(p.count / maxBucket, 25)]));
  }
  w(``);

  if (topEarners.length > 0) {
    w(`### Top 15 Earners`, ``);
    w(tableHeader(["#", "Hacker", "Points Earned"]));
    topEarners.forEach((e, i) => {
      w(tableRow([String(i + 1), e.name, fmt(e.earned)]));
    });
    w(``);
  }

  if (topSpenders.length > 0) {
    w(`### Top 15 Spenders`, ``);
    w(tableHeader(["#", "Hacker", "Points Spent"]));
    topSpenders.forEach((s, i) => {
      w(tableRow([String(i + 1), s.name, fmt(s.spent)]));
    });
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 8. SHOP ANALYTICS
  // ═══════════════════════════════════════════════════
  console.log("  [8/10] Shop analytics...");
  let shopAgg = { totalPurchases: 0, totalPointsSpent: 0, uniqueBuyers: 0, redeemed: 0 };
  let shopItemStats: { name: string; pointsCost: number; stock: number; enabled: boolean; purchases: number; revenue: number }[] = [];
  let redeemRate = { total: 0, redeemed: 0 };
  try {
    const [
      [_shopAgg],
      _shopItemStats,
      [_redeemRate],
    ] = await Promise.all([
      db.select({
        totalPurchases: count(),
        totalPointsSpent: sql<number>`COALESCE(SUM(${shopPurchases.pointsSpent}), 0)`,
        uniqueBuyers: sql<number>`COUNT(DISTINCT ${shopPurchases.userId})`,
        redeemed: sql<number>`COUNT(CASE WHEN "redeemedAt" IS NOT NULL THEN 1 END)`,
      }).from(shopPurchases),
      db.select({
        name: shopItems.name,
        pointsCost: shopItems.pointsCost,
        stock: shopItems.stock,
        enabled: shopItems.enabled,
        purchases: sql<number>`COUNT(${shopPurchases.id})`,
        revenue: sql<number>`COALESCE(SUM(${shopPurchases.pointsSpent}), 0)`,
      }).from(shopItems).leftJoin(shopPurchases, eq(shopPurchases.itemId, shopItems.id)).groupBy(shopItems.id, shopItems.name, shopItems.pointsCost, shopItems.stock, shopItems.enabled).orderBy(desc(sql`COUNT(${shopPurchases.id})`)),
      db.select({
        total: count(),
        redeemed: sql<number>`COUNT(CASE WHEN "redeemedAt" IS NOT NULL THEN 1 END)`,
      }).from(shopPurchases),
    ]);
    shopAgg = _shopAgg;
    shopItemStats = _shopItemStats;
    redeemRate = _redeemRate;
  } catch (e) {
    console.log("  ⚠ Shop tables may not exist, skipping shop analytics");
  }

  w(`## 8. Shop Analytics`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total purchases | ${fmt(shopAgg.totalPurchases)} |`);
  w(`| Total points spent in shop | ${fmt(shopAgg.totalPointsSpent)} |`);
  w(`| Unique buyers | ${fmt(shopAgg.uniqueBuyers)} |`);
  if (shopAgg.redeemed != null) {
    w(`| Items redeemed | ${fmt(shopAgg.redeemed)} / ${fmt(shopAgg.totalPurchases)} |`);
  }
  w(`| Redemption rate | ${pct(redeemRate.redeemed, redeemRate.total)} |`);
  w(``);

  if (shopItemStats.length > 0) {
    w(`### Shop Item Breakdown`, ``);
    w(tableHeader(["Item", "Cost", "Stock Left", "Enabled", "Purchases", "Points Revenue"]));
    for (const s of shopItemStats) {
      w(tableRow([s.name, fmt(s.pointsCost), fmt(s.stock), s.enabled ? "Yes" : "No", fmt(s.purchases), fmt(s.revenue)]));
    }
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // 9. FULL FUNNEL
  // ═══════════════════════════════════════════════════
  console.log("  [9/10] Funnel analysis...");
  const [
    [signedUp],
    [applied],
    [acceptedForFunnel],
    [rsvpd],
    [checkedIn],
    [activeChallenges],
    [activePoints],
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(hackerApplications).where(eq(hackerApplications.submissionStatus, "submitted")),
    db.select({ count: count() }).from(users).where(eq(users.applicationStatus, "accepted")),
    db.select({ count: count() }).from(rsvp),
    db.select({ count: sql<number>`COUNT(DISTINCT ${checkIns.userId})` }).from(checkIns),
    db.select({ count: sql<number>`COUNT(DISTINCT ${challengesSubmitted.userId})` }).from(challengesSubmitted),
    db.select({ count: sql<number>`COUNT(DISTINCT ${pointsTransactions.userId})` }).from(pointsTransactions),
  ]);

  w(`## 9. Full Hacker Funnel`, ``);
  w(`\`\`\``);
  const funnelSteps = [
    { label: "Signed Up", count: signedUp.count },
    { label: "Applied (submitted)", count: applied.count },
    { label: "Accepted", count: acceptedForFunnel.count },
    { label: "RSVP'd", count: rsvpd.count },
    { label: "Checked In (any event)", count: checkedIn.count },
    { label: "Did a Challenge", count: activeChallenges.count },
    { label: "Has Points Activity", count: activePoints.count },
  ];
  const maxFunnel = Math.max(...funnelSteps.map((f) => f.count), 1);
  for (const step of funnelSteps) {
    const barLen = Math.round((step.count / maxFunnel) * 40);
    const barStr = "█".repeat(barLen) + "░".repeat(40 - barLen);
    w(`  ${step.label.padEnd(28)} ${barStr} ${String(step.count).padStart(6)}`);
  }
  w(`\`\`\``);
  w(``);

  w(`### Funnel Conversion Rates`, ``);
  w(tableHeader(["Stage", "Count", "Step Conversion", "Overall Conversion"]));
  for (let i = 0; i < funnelSteps.length; i++) {
    const step = funnelSteps[i];
    const prevStep = i > 0 ? funnelSteps[i - 1].count : step.count;
    w(tableRow([
      step.label,
      fmt(step.count),
      i === 0 ? "-" : pct(step.count, prevStep),
      pct(step.count, funnelSteps[0].count),
    ]));
  }
  w(``);

  // Ghost hackers
  const [ghostHackers] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(rsvp).where(
    sql`${rsvp.userId} NOT IN (SELECT DISTINCT ${checkIns.userId} FROM "checkIn")
    AND ${rsvp.userId} NOT IN (SELECT DISTINCT ${challengesSubmitted.userId} FROM "challengesSubmitted")`
  );

  w(`### Engagement Flags`, ``);
  w(`| Flag | Count |`, `| --- | --- |`);
  w(`| RSVP'd but never checked in or did anything | ${fmt(ghostHackers.count)} |`);
  w(`| No-shows (RSVP'd, 0 check-ins) | ${fmt(noShows.count)} |`);
  w(``);

  // ═══════════════════════════════════════════════════
  // 10. SCHEDULE & EMAIL CAMPAIGNS
  // ═══════════════════════════════════════════════════
  console.log("  [10/10] Schedule & emails...");
  let scheduleCount = { count: 0 };
  let scheduleByType: { type: string; count: number }[] = [];
  let emailAgg = { totalCampaigns: 0, totalSent: 0, totalFailed: 0, totalRecipients: 0 };
  let campaigns: { subject: string; status: string; totalRecipients: number; sentCount: number; failedCount: number; sentAt: Date | null }[] = [];

  try {
    const [_sc, _sbt] = await Promise.all([
      db.select({ count: count() }).from(schedule),
      db.select({ type: schedule.type, count: count() }).from(schedule).groupBy(schedule.type).orderBy(desc(count())),
    ]);
    scheduleCount = _sc[0];
    scheduleByType = _sbt;
  } catch (e) {
    console.log("  ⚠ Schedule table may not exist, skipping");
  }

  try {
    const [_ea, _c] = await Promise.all([
      db.select({
        totalCampaigns: count(),
        totalSent: sql<number>`COALESCE(SUM("sentCount"), 0)`,
        totalFailed: sql<number>`COALESCE(SUM("failedCount"), 0)`,
        totalRecipients: sql<number>`COALESCE(SUM("totalRecipients"), 0)`,
      }).from(emailCampaigns),
      db.select({
        subject: emailCampaigns.subject,
        status: emailCampaigns.status,
        totalRecipients: emailCampaigns.totalRecipients,
        sentCount: emailCampaigns.sentCount,
        failedCount: emailCampaigns.failedCount,
        sentAt: emailCampaigns.sentAt,
      }).from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(15),
    ]);
    emailAgg = _ea[0];
    campaigns = _c;
  } catch (e) {
    console.log("  ⚠ Email campaign tables may not exist, skipping");
  }

  w(`## 10. Schedule & Email Campaigns`, ``);
  w(`### Schedule`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total scheduled events | ${fmt(scheduleCount.count)} |`);
  w(``);
  if (scheduleByType.length > 0) {
    w(tableHeader(["Event Type", "Count"]));
    for (const s of scheduleByType) {
      w(tableRow([s.type, fmt(s.count)]));
    }
    w(``);
  }

  w(`### Email Campaigns`, ``);
  w(`| Metric | Value |`, `| --- | --- |`);
  w(`| Total campaigns | ${fmt(emailAgg.totalCampaigns)} |`);
  w(`| Total recipients | ${fmt(emailAgg.totalRecipients)} |`);
  w(`| Total sent | ${fmt(emailAgg.totalSent)} |`);
  w(`| Total failed | ${fmt(emailAgg.totalFailed)} |`);
  w(`| Delivery success rate | ${pct(emailAgg.totalSent, emailAgg.totalRecipients)} |`);
  w(``);

  if (campaigns.length > 0) {
    w(`### Recent Campaigns`, ``);
    w(tableHeader(["Subject", "Status", "Recipients", "Sent", "Failed", "Sent At"]));
    for (const c of campaigns) {
      w(tableRow([
        c.subject,
        c.status,
        fmt(c.totalRecipients),
        fmt(c.sentCount),
        fmt(c.failedCount),
        c.sentAt ? c.sentAt.toLocaleString() : "Not sent",
      ]));
    }
    w(``);
  }

  // ═══════════════════════════════════════════════════
  // WRITE OUTPUT
  // ═══════════════════════════════════════════════════
  const output = lines.join("\n");
  console.log(`\nDone! Writing ${lines.length} lines to INSIGHTS.md...\n`);

  const fs = await import("fs");
  fs.writeFileSync("INSIGHTS.md", output, "utf-8");
  console.log("✓ INSIGHTS.md written successfully.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
