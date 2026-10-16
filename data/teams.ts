import { db } from "@/lib/db";
import { teamMembers, teams, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
