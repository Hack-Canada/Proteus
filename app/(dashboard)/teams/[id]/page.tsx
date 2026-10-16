import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team" };

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import { MAX_TEAM_SIZE } from "@/lib/constants";
import { getTeamById } from "@/data/teams";
import { isAdmin } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function TeamPage(props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.id || !isAdmin(user.role)) redirect("/");

  const { id } = await props.params;
  const team = await getTeamById(id);
  if (!team) notFound();

  return (
    <Container className="space-y-6 md:space-y-10">
      <PageBanner
        heading={team.name}
        subheading={`${team.members.length}/${MAX_TEAM_SIZE} members · created by ${team.creator?.name ?? "unknown"}`}
        backButton
      />

      {team.mixedStatuses && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Members do not share an application status. Decide them together or the team splits.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Fact label="Visibility" value={team.isPublic ? "Public" : "Private"} />
        <Fact label="Answers" value={team.answersLocked ? "Locked" : "Open"} />
        <Fact label="Invite token" value={team.inviteToken} />
      </div>

      <section className="rounded-3xl border bg-card p-6 dark:border-white/[0.06]">
        <h2 className="font-display text-2xl">Essay</h2>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed">
          {team.essay?.trim() || "No essay yet."}
        </p>
      </section>

      <div className="overflow-x-auto rounded-3xl border dark:border-white/[0.06]">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submission</th>
              <th className="px-4 py-3 font-medium">Mars answer</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {team.members.map((member) => (
              <tr key={member.userId}>
                <td className="px-4 py-3">
                  <Link href={`/users/${member.userId}`} className="font-medium hover:text-primary">
                    {member.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                  <Link
                    href={`/applications/${member.userId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Application
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">
                  {member.applicationStatus.replaceAll("_", " ")}
                </td>
                <td className="px-4 py-3 capitalize">{member.submissionStatus ?? "none"}</td>
                <td className="max-w-md whitespace-pre-line px-4 py-3">
                  {member.marsAnswer?.trim() || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4 dark:border-white/[0.06]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium">{value}</p>
    </div>
  );
}
