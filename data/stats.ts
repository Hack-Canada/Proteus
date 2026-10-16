import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";

import { MAX_TEAM_SIZE, REVIEWS_PER_APP } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  applicationReviews,
  checkIns,
  hackerApplications,
  rsvp,
  teamMembers,
  teams,
  users,
} from "@/lib/db/schema";

const submitted = eq(hackerApplications.submissionStatus, "submitted");

function num(value: unknown) {
  return Number(value ?? 0);
}

export async function getFunnel() {
  const [apps] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.submissionStatus} = 'draft')`,
      submitted: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.submissionStatus} = 'submitted')`,
      reviewed: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.submissionStatus} = 'submitted' AND ${hackerApplications.reviewCount} >= ${REVIEWS_PER_APP})`,
      needsReviews: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.submissionStatus} = 'submitted' AND ${hackerApplications.reviewCount} < ${REVIEWS_PER_APP})`,
    })
    .from(hackerApplications);

  const [decisions] = await db
    .select({
      accepted: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'accepted')`,
      waitlisted: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'waitlisted')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'rejected')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'pending')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'cancelled')`,
      reviewedUndecided: sql<number>`COUNT(*) FILTER (WHERE ${users.applicationStatus} = 'pending' AND ${hackerApplications.reviewCount} >= ${REVIEWS_PER_APP})`,
    })
    .from(hackerApplications)
    .innerJoin(users, eq(hackerApplications.userId, users.id))
    .where(submitted);

  const [rsvps] = await db.select({ count: count() }).from(rsvp);
  const [checkedIn] = await db
    .select({ count: count() })
    .from(checkIns)
    .where(eq(checkIns.eventName, "hackathon-check-in"));
  const [awaitingRsvp] = await db
    .select({ count: count() })
    .from(users)
    .leftJoin(rsvp, eq(rsvp.userId, users.id))
    .where(and(eq(users.applicationStatus, "accepted"), sql`${rsvp.userId} IS NULL`));

  const submittedCount = num(apps?.submitted);
  const accepted = num(decisions?.accepted);
  const rsvpCount = num(rsvps?.count);

  return {
    draft: num(apps?.draft),
    submitted: submittedCount,
    reviewed: num(apps?.reviewed),
    needsReviews: num(apps?.needsReviews),
    accepted,
    waitlisted: num(decisions?.waitlisted),
    rejected: num(decisions?.rejected),
    pending: num(decisions?.pending),
    cancelled: num(decisions?.cancelled),
    reviewedUndecided: num(decisions?.reviewedUndecided),
    rsvp: rsvpCount,
    checkedIn: num(checkedIn?.count),
    awaitingRsvp: num(awaitingRsvp?.count),
    acceptanceRate: submittedCount > 0 ? (accepted / submittedCount) * 100 : 0,
    rsvpRate: accepted > 0 ? (rsvpCount / accepted) * 100 : 0,
    checkInRate: rsvpCount > 0 ? (num(checkedIn?.count) / rsvpCount) * 100 : 0,
    reviewCoverage: submittedCount > 0 ? (num(apps?.reviewed) / submittedCount) * 100 : 0,
  };
}

export async function getApplicationsOverTime() {
  // ponytail: no submittedAt column. updatedAt is the closest signal and drifts if the row is edited later.
  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(DATE(${hackerApplications.updatedAt}), 'Mon DD')`,
      count: count(),
    })
    .from(hackerApplications)
    .where(submitted)
    .groupBy(
      sql`DATE(${hackerApplications.updatedAt})`,
      sql`TO_CHAR(DATE(${hackerApplications.updatedAt}), 'Mon DD')`,
    )
    .orderBy(sql`DATE(${hackerApplications.updatedAt})`);

  return rows.map((row) => ({ date: row.date, count: num(row.count) }));
}

export async function getTeamStats() {
  const [teamCount] = await db.select({ count: count() }).from(teams);
  const sizes = await db
    .select({ size: count() })
    .from(teamMembers)
    .groupBy(teamMembers.teamId);
  const totalMembers = sizes.reduce((sum, row) => sum + num(row.size), 0);
  const [split] = await db
    .select({
      team: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.isTeam} = true)`,
      solo: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.isTeam} = false)`,
    })
    .from(hackerApplications)
    .where(submitted);

  return {
    teams: num(teamCount?.count),
    averageSize: sizes.length > 0 ? totalMembers / sizes.length : 0,
    fullTeams: sizes.filter((row) => num(row.size) >= MAX_TEAM_SIZE).length,
    teamApplicants: num(split?.team),
    soloApplicants: num(split?.solo),
  };
}

export async function getTravelStats() {
  const [row] = await db
    .select({
      count: count(),
      total: sql<number>`COALESCE(SUM(${hackerApplications.travelAmount}), 0)`,
    })
    .from(hackerApplications)
    .where(
      and(submitted, eq(hackerApplications.needsTravelReimbursement, true)),
    );

  return { count: num(row?.count), total: num(row?.total) };
}

export async function getPeople() {
  const rows = await db
    .select({ role: users.role, count: count() })
    .from(users)
    .groupBy(users.role);
  const byRole = Object.fromEntries(rows.map((row) => [row.role, num(row.count)]));
  return {
    total: rows.reduce((sum, row) => sum + num(row.count), 0),
    byRole,
  };
}

export async function getTracks() {
  return db
    .select({
      applicationType: hackerApplications.applicationType,
      applicants: sql<number>`COUNT(${hackerApplications.userId})`,
    })
    .from(hackerApplications)
    .where(submitted)
    .groupBy(hackerApplications.applicationType)
    .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`);
}

export async function getTopCountries(limit = 8) {
  const rows = await db
    .select({
      country: hackerApplications.country,
      applicants: sql<number>`COUNT(${hackerApplications.userId})`,
    })
    .from(hackerApplications)
    .where(and(submitted, isNotNull(hackerApplications.country)))
    .groupBy(hackerApplications.country)
    .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`)
    .limit(limit);
  return rows.map((row) => ({
    country: row.country || "Not specified",
    applicants: num(row.applicants),
  }));
}

export async function getReviewTrend() {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(${applicationReviews.createdAt}, 'MM/DD')`,
      count: count(),
    })
    .from(applicationReviews)
    .where(gte(applicationReviews.createdAt, since))
    .groupBy(
      sql`TO_CHAR(${applicationReviews.createdAt}, 'MM/DD')`,
      sql`DATE(${applicationReviews.createdAt})`,
    )
    .orderBy(sql`DATE(${applicationReviews.createdAt})`);
  return rows.map((row) => ({ date: row.date, count: num(row.count) }));
}
