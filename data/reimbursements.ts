import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getTeamById, type ApplicationTeam } from "@/data/teams";
import { db } from "@/lib/db";
import {
  hackerApplications,
  teamMembers,
  teams,
  users,
  type HackerApplicationsSelectData,
} from "@/lib/db/schema";
import { geocodeMany, travelQuery, type Place } from "@/lib/geocode";
import {
  AMOUNT_BUCKETS,
  DISTANCE_BANDS,
  amountBucket,
  bandOf,
  type DistanceBand,
} from "@/lib/travel";

const eligible = and(
  eq(hackerApplications.submissionStatus, "submitted"),
  eq(hackerApplications.needsTravelReimbursement, true),
);

function num(value: unknown) {
  return Number(value ?? 0);
}

function asDecision(value: string | null): "approved" | "rejected" | null {
  return value === "approved" || value === "rejected" ? value : null;
}

function personName(
  application: { firstName: string | null; lastName: string | null },
  fallback?: string | null,
) {
  const name = [application.firstName, application.lastName].filter(Boolean).join(" ");
  return name || fallback || "No name";
}

export type ReimbursementStats = {
  requested: number;
  requestedTotal: number;
  reviewed: number;
  pending: number;
  approved: number;
  approvedTotal: number;
  rejected: number;
  approvedRsvp: number;
  approvedCheckedIn: number;
  approvedAccepted: number;
  team: number;
  solo: number;
};

export async function getReimbursementStats(): Promise<ReimbursementStats> {
  // #region agent log
  const statsStarted = Date.now();
  // #endregion
  const [row] = await db
    .select({
      requested: sql<number>`COUNT(*)`,
      requestedTotal: sql<number>`COALESCE(SUM(${hackerApplications.travelAmount}), 0)`,
      reviewed: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} IS NOT NULL)`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} IS NULL)`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} = 'approved')`,
      approvedTotal: sql<number>`COALESCE(SUM(${hackerApplications.travelApprovedAmount}) FILTER (WHERE ${hackerApplications.travelDecision} = 'approved'), 0)`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} = 'rejected')`,
      approvedRsvp: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} = 'approved' AND EXISTS (SELECT 1 FROM "rsvp" WHERE "rsvp"."userId" = ${hackerApplications.userId}))`,
      approvedCheckedIn: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} = 'approved' AND EXISTS (SELECT 1 FROM "checkIn" WHERE "checkIn"."userId" = ${hackerApplications.userId} AND "checkIn"."eventName" = 'hackathon-check-in'))`,
      approvedAccepted: sql<number>`COUNT(*) FILTER (WHERE ${hackerApplications.travelDecision} = 'approved' AND ${users.applicationStatus} = 'accepted')`,
      team: sql<number>`COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "teamMember" WHERE "teamMember"."userId" = ${hackerApplications.userId}))`,
      solo: sql<number>`COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "teamMember" WHERE "teamMember"."userId" = ${hackerApplications.userId}))`,
    })
    .from(hackerApplications)
    .innerJoin(users, eq(users.id, hackerApplications.userId))
    .where(eligible);

  // #region agent log
  fetch("http://127.0.0.1:7416/ingest/d6da3325-2e0f-40ba-870a-ac5d82dcc36a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f3da0c" },
    body: JSON.stringify({
      sessionId: "f3da0c",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "data/reimbursements.ts:getReimbursementStats",
      message: "stats query finished",
      data: { ms: Date.now() - statsStarted, requested: num(row?.requested) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return {
    requested: num(row?.requested),
    requestedTotal: num(row?.requestedTotal),
    reviewed: num(row?.reviewed),
    pending: num(row?.pending),
    approved: num(row?.approved),
    approvedTotal: num(row?.approvedTotal),
    rejected: num(row?.rejected),
    approvedRsvp: num(row?.approvedRsvp),
    approvedCheckedIn: num(row?.approvedCheckedIn),
    approvedAccepted: num(row?.approvedAccepted),
    team: num(row?.team),
    solo: num(row?.solo),
  };
}

export type TravelRow = {
  userId: string;
  name: string;
  travelFrom: string | null;
  place: Place | null;
  band: DistanceBand;
  requested: number;
  decision: "approved" | "rejected" | null;
  approvedAmount: number | null;
  applicationStatus: string;
  teamId: string | null;
  teamName: string | null;
  rsvp: boolean;
  checkedIn: boolean;
};

function flagged(value: unknown) {
  return value === true || value === "t" || value === "true";
}

export async function getTravelRows(): Promise<TravelRow[]> {
  // #region agent log
  const rowsStarted = Date.now();
  // #endregion
  const rows = await db
    .select({
      userId: hackerApplications.userId,
      firstName: hackerApplications.firstName,
      lastName: hackerApplications.lastName,
      country: hackerApplications.country,
      travelFrom: hackerApplications.travelFrom,
      travelAmount: hackerApplications.travelAmount,
      travelDecision: hackerApplications.travelDecision,
      travelApprovedAmount: hackerApplications.travelApprovedAmount,
      applicationStatus: users.applicationStatus,
      teamId: teams.id,
      teamName: teams.name,
      hasRsvp: sql<boolean>`EXISTS (SELECT 1 FROM "rsvp" WHERE "rsvp"."userId" = ${hackerApplications.userId})`,
      hasCheckIn: sql<boolean>`EXISTS (SELECT 1 FROM "checkIn" WHERE "checkIn"."userId" = ${hackerApplications.userId} AND "checkIn"."eventName" = 'hackathon-check-in')`,
    })
    .from(hackerApplications)
    .innerJoin(users, eq(users.id, hackerApplications.userId))
    .leftJoin(teamMembers, eq(teamMembers.userId, hackerApplications.userId))
    .leftJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eligible)
    .orderBy(asc(hackerApplications.updatedAt), asc(hackerApplications.userId));

  const queries = rows.map((row) => travelQuery(row.travelFrom, row.country));
  // #region agent log
  fetch("http://127.0.0.1:7416/ingest/d6da3325-2e0f-40ba-870a-ac5d82dcc36a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f3da0c" },
    body: JSON.stringify({
      sessionId: "f3da0c",
      runId: "pre-fix",
      hypothesisId: "H3-H4",
      location: "data/reimbursements.ts:getTravelRows",
      message: "travel rows query finished",
      data: {
        dbMs: Date.now() - rowsStarted,
        rowCount: rows.length,
        uniqueUsers: new Set(rows.map((row) => row.userId)).size,
        uniqueQueries: new Set(queries.filter(Boolean)).size,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  const geoStarted = Date.now();
  // #endregion
  const places = await geocodeMany(queries);
  // #region agent log
  fetch("http://127.0.0.1:7416/ingest/d6da3325-2e0f-40ba-870a-ac5d82dcc36a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f3da0c" },
    body: JSON.stringify({
      sessionId: "f3da0c",
      runId: "post-fix-3",
      hypothesisId: "H6",
      location: "data/reimbursements.ts:getTravelRows",
      message: "geocode finished",
      data: { geoMs: Date.now() - geoStarted, placed: places.size },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return rows.map((row, index) => {
    const query = queries[index];
    const place = query ? places.get(query) ?? null : null;
    return {
      userId: row.userId,
      name: personName(row),
      travelFrom: row.travelFrom,
      place,
      band: bandOf(place?.km ?? null),
      requested: row.travelAmount ?? 0,
      decision: asDecision(row.travelDecision),
      approvedAmount: row.travelApprovedAmount,
      applicationStatus: row.applicationStatus,
      teamId: row.teamId,
      teamName: row.teamName,
      rsvp: flagged(row.hasRsvp),
      checkedIn: flagged(row.hasCheckIn),
    };
  });
}

function sumRequested(rows: TravelRow[]) {
  return rows.reduce((sum, row) => sum + row.requested, 0);
}

function sumApproved(rows: TravelRow[]) {
  return rows.reduce(
    (sum, row) => sum + (row.decision === "approved" ? row.approvedAmount ?? 0 : 0),
    0,
  );
}

export function bandTotals(rows: TravelRow[]) {
  return DISTANCE_BANDS.map((band) => {
    const matching = rows.filter((row) => row.band === band.label);
    return { band: band.label, count: matching.length, total: sumRequested(matching) };
  }).filter((band) => band.band !== "Unknown" || band.count > 0);
}

export function bucketTotals(rows: TravelRow[]) {
  return AMOUNT_BUCKETS.map((bucket) => {
    const matching = rows.filter((row) => amountBucket(row.requested) === bucket.label);
    return { label: bucket.label, count: matching.length, total: sumRequested(matching) };
  });
}

export type PlaceGroup = {
  key: string;
  label: string;
  km: number | null;
  rows: TravelRow[];
  asked: number;
  approved: number;
};

export type BandGroup = {
  band: (typeof DISTANCE_BANDS)[number];
  places: PlaceGroup[];
  people: number;
  asked: number;
  approved: number;
};

export function placesByBand(rows: TravelRow[]): BandGroup[] {
  return DISTANCE_BANDS.map((band) => {
    const inBand = rows.filter((row) => row.band === band.label);
    const byPlace = new Map<string, TravelRow[]>();
    for (const row of inBand) {
      const key = row.place?.label ?? (row.travelFrom?.trim() || "No answer");
      byPlace.set(key, [...(byPlace.get(key) ?? []), row]);
    }
    const places = [...byPlace.entries()]
      .map(([key, group]) => ({
        key,
        label: key,
        km: group[0].place?.km ?? null,
        rows: group,
        asked: sumRequested(group),
        approved: sumApproved(group),
      }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || b.rows.length - a.rows.length);
    return {
      band,
      places,
      people: inBand.length,
      asked: sumRequested(inBand),
      approved: sumApproved(inBand),
    };
  }).filter((group) => group.people > 0);
}

export type TravelCaseMember = {
  userId: string;
  name: string;
  email: string;
  applicationStatus: string;
  application: HackerApplicationsSelectData | null;
  requestsTravel: boolean;
  requested: number;
  decision: "approved" | "rejected" | null;
  approvedAmount: number | null;
  requestedChanged: boolean;
  place: Place | null;
};

export type TravelCase = {
  focusUserId: string;
  team: ApplicationTeam | null;
  members: TravelCaseMember[];
};

function isTravelRequest(application: HackerApplicationsSelectData) {
  return application.submissionStatus === "submitted" && application.needsTravelReimbursement === true;
}

function toMember(
  application: HackerApplicationsSelectData | null,
  user: { userId: string; name: string; email: string; applicationStatus: string },
): TravelCaseMember {
  const requestsTravel = !!application && isTravelRequest(application);
  const decision = application ? asDecision(application.travelDecision) : null;
  const approvedAmount = application?.travelApprovedAmount ?? null;
  const requested = application?.travelAmount ?? 0;
  return {
    userId: user.userId,
    name: application ? personName(application, user.name) : user.name,
    email: user.email,
    applicationStatus: user.applicationStatus,
    application,
    requestsTravel,
    requested,
    decision,
    approvedAmount,
    requestedChanged:
      decision === "approved" && approvedAmount != null && requested !== approvedAmount,
    place: null,
  };
}

async function withPlaces(members: TravelCaseMember[]) {
  const queries = members.map((member) =>
    member.requestsTravel && member.application
      ? travelQuery(member.application.travelFrom, member.application.country)
      : null,
  );
  const places = await geocodeMany(queries);
  return members.map((member, index) => {
    const query = queries[index];
    return { ...member, place: query ? places.get(query) ?? null : null };
  });
}

export async function getTravelCase(
  userId?: string,
): Promise<{ kind: "empty" } | { kind: "missing" } | { kind: "case"; value: TravelCase }> {
  let focusId = userId;
  if (!focusId) {
    // ponytail: hackerApplication has no submittedAt; updatedAt is the last save.
    const [next] = await db
      .select({ userId: hackerApplications.userId })
      .from(hackerApplications)
      .where(and(eligible, isNull(hackerApplications.travelDecision)))
      .orderBy(asc(hackerApplications.updatedAt), asc(hackerApplications.userId))
      .limit(1);
    if (!next) return { kind: "empty" };
    focusId = next.userId;
  }

  const [focus] = await db
    .select()
    .from(hackerApplications)
    .where(eq(hackerApplications.userId, focusId))
    .limit(1);
  if (!focus || !isTravelRequest(focus)) return { kind: "missing" };

  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, focusId))
    .limit(1);

  if (!membership) {
    const [user] = await db
      .select({
        name: users.name,
        email: users.email,
        applicationStatus: users.applicationStatus,
      })
      .from(users)
      .where(eq(users.id, focusId))
      .limit(1);
    return {
      kind: "case",
      value: {
        focusUserId: focusId,
        team: null,
        members: await withPlaces([
          toMember(focus, {
            userId: focusId,
            name: user?.name ?? "",
            email: user?.email ?? focus.email ?? "",
            applicationStatus: user?.applicationStatus ?? "pending",
          }),
        ]),
      },
    };
  }

  const team = await getTeamById(membership.teamId);
  if (!team) return { kind: "missing" };

  const applications = await db
    .select()
    .from(hackerApplications)
    .where(
      inArray(
        hackerApplications.userId,
        team.members.map((member) => member.userId),
      ),
    );
  const byUser = new Map(applications.map((application) => [application.userId, application]));
  const members = team.members.map((member) =>
    toMember(byUser.get(member.userId) ?? null, member),
  );
  members.sort((a, b) => {
    if (a.userId === focusId) return -1;
    if (b.userId === focusId) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    kind: "case",
    value: {
      focusUserId: focusId,
      team: {
        id: team.id,
        name: team.name,
        essay: team.essay,
        members: team.members.map((member) => ({
          userId: member.userId,
          name: member.name,
          email: member.email,
          marsAnswer: member.marsAnswer,
        })),
      },
      members: await withPlaces(members),
    },
  };
}
