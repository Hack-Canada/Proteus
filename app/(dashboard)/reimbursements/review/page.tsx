import type { Metadata } from "next";

import { getCurrentUser } from "@/auth";
import ApplicationInfo from "@/components/ApplicationInfo";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import TravelReviewForm from "@/components/reimbursements/TravelReviewForm";
import { Button } from "@/components/ui/button";
import { getTravelCase, type TravelCase } from "@/data/reimbursements";
import { isAdmin } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Travel review" };

export default async function TravelReviewPage(props: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id || !isAdmin(user.role)) redirect("/");

  const { userId } = await props.searchParams;
  const result = await getTravelCase(userId);

  return (
    <Container className="max-w-screen-lg space-y-6 md:space-y-8">
      <PageBanner
        backButton
        heading="Travel review"
        subheading="Decide the amount, save it, then take the next person."
      />

      {result.kind === "empty" && (
        <Empty
          title="Queue empty"
          body="Everyone who asked for travel has a decision. Open someone from the list if you want to change it."
        />
      )}

      {result.kind === "missing" && (
        <Empty
          title="Not a travel request"
          body="That person does not have a submitted travel reimbursement request."
        />
      )}

      {result.kind === "case" && (
        <TravelCaseView value={result.value} />
      )}
    </Container>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border p-8 text-center dark:border-white/[0.06]">
      <p className="font-display text-3xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4">
        <Link href="/reimbursements">Back to reimbursements</Link>
      </Button>
    </div>
  );
}

function TravelCaseView({ value }: { value: TravelCase }) {
  const requesting = value.members.filter((member) => member.requestsTravel);

  return (
    <div className="space-y-6">
      {value.team && (
        <div className="rounded-3xl border p-5 dark:border-white/[0.06]">
          <p className="text-sm text-muted-foreground">Team</p>
          <Link href={`/teams/${value.team.id}`} className="font-display text-3xl hover:underline">
            {value.team.name}
          </Link>
          {value.team.essay?.trim() && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {value.team.essay}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {value.members.map((member) => (
          <details
            key={member.userId}
            open={member.userId === value.focusUserId}
            className="rounded-3xl border px-4 py-3 dark:border-white/[0.06]"
          >
            <summary className="cursor-pointer font-medium">
              {member.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {member.requestsTravel
                  ? member.decision ?? "travel pending"
                  : "no travel request"}
                {" · "}
                {member.applicationStatus.replaceAll("_", " ")}
              </span>
            </summary>
            <div className="pt-4">
              {member.application ? (
                <ApplicationInfo
                  hacker={member.application}
                  team={member.userId === value.focusUserId ? value.team : null}
                  linkTeammates
                />
              ) : (
                <p className="text-sm text-muted-foreground">No application on file.</p>
              )}
            </div>
          </details>
        ))}
      </div>

      {requesting.length > 0 && (
        <TravelReviewForm
          key={requesting
            .map((person) => `${person.userId}:${person.decision}:${person.approvedAmount}`)
            .join("|")}
          people={requesting}
          focusUserId={value.focusUserId}
        />
      )}
    </div>
  );
}
