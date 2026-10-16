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

export const TRAVEL_CAP = 200;

export const TRAVEL_REGIONS = [
  "GTA",
  "Ontario",
  "Other Canada",
  "USA",
  "International",
] as const;

export type TravelRegion = (typeof TRAVEL_REGIONS)[number];

export const AMOUNT_BUCKETS = [
  { label: "$0–50", min: 0, max: 50 },
  { label: "$51–100", min: 51, max: 100 },
  { label: "$101–150", min: 101, max: 150 },
  { label: "$151–200", min: 151, max: 200 },
] as const;

const eligible = and(
  eq(hackerApplications.submissionStatus, "submitted"),
  eq(hackerApplications.needsTravelReimbursement, true),
);

// ponytail: keyword heuristic on free-text "where from" plus the application country.
// Ceiling: unlisted cities and a bare "London" outside Canada fall through to the country.
// Upgrade path: geocode and cache coordinates.
const GTA = [
  "toronto",
  "mississauga",
  "brampton",
  "markham",
  "vaughan",
  "scarborough",
  "north york",
  "etobicoke",
  "richmond hill",
  "oakville",
];

const ONTARIO = [
  "ontario",
  "waterloo",
  "ottawa",
  "kingston",
  "hamilton",
  "guelph",
  "windsor",
  "kitchener",
  "cambridge",
  "london",
  "barrie",
  "niagara",
];

const OTHER_CANADA = [
  "british columbia",
  "vancouver",
  "kelowna",
  "victoria",
  "alberta",
  "edmonton",
  "calgary",
  "saskatchewan",
  "regina",
  "saskatoon",
  "manitoba",
  "winnipeg",
  "quebec",
  "québec",
  "montreal",
  "montréal",
  "new brunswick",
  "fredericton",
  "nova scotia",
  "halifax",
  "prince edward",
  "newfoundland",
  "yukon",
  "nunavut",
  "bc",
  "ab",
  "sk",
  "mb",
  "qc",
  "nb",
  "ns",
  "pe",
  "nl",
];

const CITY_SUFFIXES = [
  "newfoundland and labrador",
  "prince edward island",
  "british columbia",
  "new brunswick",
  "nova scotia",
  "saskatchewan",
  "north carolina",
  "newfoundland",
  "manitoba",
  "ontario",
  "alberta",
  "quebec",
  "québec",
  "nigeria",
  "florida",
  "oregon",
  "bc",
  "ab",
  "sk",
  "mb",
  "on",
  "qc",
  "nb",
  "ns",
  "pe",
  "nl",
  "nc",
  "or",
  "fl",
  "pk",
];

function hasTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`).test(text);
}

function clean(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function isCanada(country: string | null | undefined) {
  const value = clean(country);
  return value === "canada" || value === "ca";
}

function isUsa(country: string | null | undefined) {
  const value = clean(country);
  return (
    value === "united states" ||
    value === "united states of america" ||
    value === "usa" ||
    value === "us"
  );
}

export function regionOf(
  country: string | null | undefined,
  travelFrom: string | null | undefined,
): TravelRegion {
  const from = clean(travelFrom);
  if (GTA.some((term) => hasTerm(from, term))) return "GTA";

  const ontarioHit = ONTARIO.some((term) => hasTerm(from, term)) || hasTerm(from, "on");
  const onlyLondon =
    hasTerm(from, "london") &&
    !hasTerm(from, "ontario") &&
    !hasTerm(from, "on") &&
    !ONTARIO.some((term) => term !== "london" && hasTerm(from, term));
  if (ontarioHit && !(onlyLondon && country?.trim() && !isCanada(country))) {
    return "Ontario";
  }

  if (OTHER_CANADA.some((term) => hasTerm(from, term))) return "Other Canada";
  if (isUsa(country)) return "USA";
  if (isCanada(country)) return "Other Canada";
  return "International";
}

export function normalizeCity(travelFrom: string | null | undefined) {
  let text = clean(travelFrom);
  let previous = "";
  while (text && text !== previous) {
    previous = text;
    const suffix = CITY_SUFFIXES.find((item) =>
      new RegExp(`(?:,\\s*|\\s+)${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).test(text),
    );
    if (!suffix) break;
    text = text.replace(new RegExp(`(?:,\\s*|\\s+)${suffix}$`), "").trim();
  }
  return text;
}

export function cityLabel(travelFrom: string | null | undefined) {
  const city = normalizeCity(travelFrom);
  if (!city) return "Unknown";
  return city.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function amountBucket(amount: number) {
  return (
    AMOUNT_BUCKETS.find((bucket) => amount >= bucket.min && amount <= bucket.max)?.label ??
    AMOUNT_BUCKETS[AMOUNT_BUCKETS.length - 1].label
  );
}

export function cad(amount: number) {
  return `$${amount.toLocaleString("en-CA")}`;
}

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
  city: string;
  region: TravelRegion;
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

  return rows.map((row) => ({
    userId: row.userId,
    name: personName(row),
    travelFrom: row.travelFrom,
    city: cityLabel(row.travelFrom),
    region: regionOf(row.country, row.travelFrom),
    requested: row.travelAmount ?? 0,
    decision: asDecision(row.travelDecision),
    approvedAmount: row.travelApprovedAmount,
    applicationStatus: row.applicationStatus,
    teamId: row.teamId,
    teamName: row.teamName,
    rsvp: flagged(row.hasRsvp),
    checkedIn: flagged(row.hasCheckIn),
  }));
}

export function regionTotals(rows: TravelRow[]) {
  return TRAVEL_REGIONS.map((region) => {
    const matching = rows.filter((row) => row.region === region);
    return {
      region,
      count: matching.length,
      total: matching.reduce((sum, row) => sum + row.requested, 0),
    };
  });
}

export function bucketTotals(rows: TravelRow[]) {
  return AMOUNT_BUCKETS.map((bucket) => {
    const matching = rows.filter((row) => amountBucket(row.requested) === bucket.label);
    return {
      label: bucket.label,
      count: matching.length,
      total: matching.reduce((sum, row) => sum + row.requested, 0),
    };
  });
}

export function topCities(rows: TravelRow[], limit = 10) {
  const totals = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const current = totals.get(row.city) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += row.requested;
    totals.set(row.city, current);
  }
  return [...totals.entries()]
    .map(([city, value]) => ({ city, ...value }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, limit);
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
  };
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
        members: [
          toMember(focus, {
            userId: focusId,
            name: user?.name ?? "",
            email: user?.email ?? focus.email ?? "",
            applicationStatus: user?.applicationStatus ?? "pending",
          }),
        ],
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
      members,
    },
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`reimbursements: ${message}`);
}

function selfCheck() {
  assert(regionOf("Canada", "london ontario") === "Ontario", "london ontario");
  assert(regionOf("Canada", "London") === "Ontario", "London, Canada");
  assert(regionOf("United Kingdom", "London") === "International", "London, UK");
  assert(regionOf("Canada", "University of waterloo") === "Ontario", "waterloo");
  assert(regionOf("Canada", "Toronto") === "GTA", "Toronto");
  assert(regionOf("Canada", "Mississauga, ON") === "GTA", "Mississauga");
  assert(regionOf("Canada", "Edmonton, AB") === "Other Canada", "Edmonton");
  assert(regionOf("Canada", "Fredericton, New Brunswick") === "Other Canada", "Fredericton");
  assert(regionOf("Canada", "Vancouver, BC") === "Other Canada", "Vancouver");
  assert(regionOf("United States of America", "Chapel Hill, NC") === "USA", "Chapel Hill");
  assert(regionOf("United States of America", "New York") === "USA", "New York");
  assert(regionOf("Pakistan", "Islamabad, PK") === "International", "Islamabad");
  assert(regionOf("Nigeria", "Kwara, Nigeria") === "International", "Kwara");
  assert(regionOf("Canada", "") === "Other Canada", "blank Canada");
  assert(normalizeCity("Edmonton, AB") === "edmonton", "edmonton comma");
  assert(normalizeCity("edmonton") === "edmonton", "edmonton plain");
  assert(normalizeCity("Edmonton Alberta") === "edmonton", "edmonton alberta");
  assert(normalizeCity("University of waterloo") === "university of waterloo", "waterloo campus");
  assert(normalizeCity("Islamabad, PK") === "islamabad", "islamabad");
  assert(amountBucket(0) === "$0–50", "bucket 0");
  assert(amountBucket(50) === "$0–50", "bucket 50");
  assert(amountBucket(51) === "$51–100", "bucket 51");
  assert(amountBucket(150) === "$101–150", "bucket 150");
  assert(amountBucket(151) === "$151–200", "bucket 151");
  assert(amountBucket(200) === "$151–200", "bucket 200");
}

selfCheck();
