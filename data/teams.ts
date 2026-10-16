import { MAX_TEAM_SIZE, RESULTS_PER_PAGE } from "@/lib/constants";
import { db } from "@/lib/db";
import { hackerApplications, teamMembers, teams, users } from "@/lib/db/schema";
import { count, desc, eq, ilike, inArray } from "drizzle-orm";

export type ApplicationTeam = {
  id: string;
  name: string;
  essay: string | null;
  members: {
    userId: string;
    name: string;
    email: string;
    marsAnswer: string | null;
  }[];
};

export async function getTeamForUser(
  userId: string,
): Promise<ApplicationTeam | null> {
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  if (!membership) return null;

  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      essay: teams.essay,
    })
    .from(teams)
    .where(eq(teams.id, membership.teamId))
    .limit(1);

  if (!team) return null;

  const members = await db
    .select({
      userId: teamMembers.userId,
      marsAnswer: teamMembers.marsAnswer,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, membership.teamId));

  return { ...team, members };
}

export async function getTeams({ search, page }: { search: string; page: number }) {
  const where = search ? ilike(teams.name, `%${search}%`) : undefined;
  const [total] = await db.select({ count: count() }).from(teams).where(where);
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      isPublic: teams.isPublic,
      answersLocked: teams.answersLocked,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(where)
    .orderBy(desc(teams.createdAt))
    .limit(RESULTS_PER_PAGE)
    .offset((page - 1) * RESULTS_PER_PAGE);

  const ids = rows.map((row) => row.id);
  const members =
    ids.length === 0
      ? []
      : await db
          .select({
            teamId: teamMembers.teamId,
            userId: teamMembers.userId,
            name: users.name,
            applicationStatus: users.applicationStatus,
          })
          .from(teamMembers)
          .innerJoin(users, eq(users.id, teamMembers.userId))
          .where(inArray(teamMembers.teamId, ids));

  return {
    total: total?.count ?? 0,
    teams: rows.map((row) => ({
      ...row,
      members: members.filter((member) => member.teamId === row.id),
    })),
  };
}

export async function getTeamById(id: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return null;

  const [creator] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, team.createdBy))
    .limit(1);

  const members = await db
    .select({
      userId: teamMembers.userId,
      name: users.name,
      email: users.email,
      applicationStatus: users.applicationStatus,
      submissionStatus: hackerApplications.submissionStatus,
      marsAnswer: teamMembers.marsAnswer,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(hackerApplications, eq(hackerApplications.userId, teamMembers.userId))
    .where(eq(teamMembers.teamId, id));

  const statuses = new Set(members.map((member) => member.applicationStatus));

  return {
    ...team,
    creator,
    members,
    mixedStatuses: statuses.size > 1,
    maxSize: MAX_TEAM_SIZE,
  };
}
