import type { Metadata } from "next";

export const metadata: Metadata = { title: "Teams" };

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import PaginationControls from "@/components/PaginationControls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MAX_TEAM_SIZE, RESULTS_PER_PAGE } from "@/lib/constants";
import { getTeams } from "@/data/teams";
import { isAdmin } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TeamsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id || !isAdmin(user.role)) redirect("/");

  const searchParams = await props.searchParams;
  const search = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { teams, total } = await getTeams({ search, page });
  const params = new URLSearchParams();
  if (search) params.set("q", search);

  return (
    <Container className="space-y-6 md:space-y-10">
      <PageBanner
        heading="Teams"
        subheading="Every team, who is on it, and whether their application statuses agree."
      />

      <form className="flex max-w-md gap-2" action="/teams">
        <Input name="q" defaultValue={search} placeholder="Search team name" />
        <Button type="submit">Search</Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {total} team{total === 1 ? "" : "s"}
      </p>

      <div className="space-y-3">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="block rounded-3xl border bg-card p-5 transition-colors hover:bg-accent/40 dark:border-white/[0.06]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-2xl">{team.name}</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {team.members.length}/{MAX_TEAM_SIZE}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {team.members.map((member) => (
                <span
                  key={member.userId}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {member.name}{" "}
                  <span className="text-muted-foreground">
                    {member.applicationStatus.replaceAll("_", " ")}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {team.isPublic ? "Public" : "Private"}
              {team.answersLocked ? " · answers locked" : ""} ·{" "}
              {team.createdAt.toLocaleDateString("en-CA")}
            </p>
          </Link>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams match.</p>
        )}
      </div>

      {total > RESULTS_PER_PAGE && (
        <PaginationControls
          totalNumOfUsers={total}
          search={params.toString()}
          table="teams"
        />
      )}
    </Container>
  );
}
