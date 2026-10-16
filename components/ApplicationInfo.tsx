import { formatDate, getResumeUrl } from "@/lib/utils";
import {
  User as UserIcon,
  Mail,
  Calendar,
  School,
  FileCheck,
  GraduationCap,
  Globe,
  Github,
  Linkedin,
  ExternalLink,
  Link as LinkIcon,
  CircleUserRound,
  MessageSquare,
  Clock,
  FileSpreadsheet,
  Plane,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { HackerApplicationsSelectData } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InfoRow from "./InfoRow";
import { NORMAL_PROMPTS, TEAM_PROMPTS, trackLabel } from "@/config/apply";
import type { ApplicationTeam } from "@/data/teams";

const EmptyValue = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "rounded-md bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
      className,
    )}
  >
    [EMPTY]
  </span>
);

type Props = {
  hacker: HackerApplicationsSelectData | null;
  hideBackgroundInfo?: boolean;
  team?: ApplicationTeam | null;
  linkTeammates?: boolean;
};

function externalLink(href: string, label: string) {
  return (
    <Link
      href={href}
      target="_blank"
      className="inline-flex items-center gap-2 text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
    >
      {label} <ExternalLink className="size-4" />
    </Link>
  );
}

const yesNo = (value: boolean | null) => (value ? "Yes" : "No");
const agreed = (value: boolean | null) => (value ? "Agreed" : "Not agreed");

const ApplicationInfo = ({
  hacker,
  hideBackgroundInfo,
  team,
  linkTeammates,
}: Props) => {
  if (!hacker) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6">
          <p className="text-center text-destructive">
            Could not find a hacker with the given ID.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-background via-background/80 to-background">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-xl font-semibold tracking-tight">
          Application Information
        </CardTitle>
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {trackLabel(hacker.applicationType)}
        </span>
      </CardHeader>
      <hr className="mb-4" />
      <CardContent>
        <div className="grid w-full gap-y-3">
          <h3 className="mt-2 text-lg font-semibold">Basics</h3>
          {!hideBackgroundInfo && (
            <InfoRow
              label="ID"
              value={hacker.id}
              icon={<UserIcon className="size-4" />}
            />
          )}
          <InfoRow
            label="Name"
            value={
              hacker.firstName || hacker.lastName ? (
                `${hacker.firstName || ""} ${hacker.lastName || ""}`.trim()
              ) : (
                <EmptyValue />
              )
            }
            icon={<UserIcon className="size-4" />}
          />
          <InfoRow
            label="Email"
            value={hacker.email || <EmptyValue />}
            icon={<Mail className="size-4" />}
          />
          <InfoRow
            label="Age"
            value={hacker.age?.toString() || <EmptyValue />}
            icon={<CircleUserRound className="size-4" />}
          />
          <InfoRow
            label="Country"
            value={hacker.country || <EmptyValue />}
            icon={<Globe className="size-4" />}
          />
          <InfoRow
            label="School"
            value={hacker.school || <EmptyValue />}
            icon={<School className="size-4" />}
          />
          <InfoRow
            label="Level of Study"
            value={hacker.levelOfStudy || <EmptyValue />}
            icon={<GraduationCap className="size-4" />}
          />
          {hacker.hackathonsAttended && (
            <InfoRow
              label="Hackathons Attended"
              value={hacker.hackathonsAttended}
              icon={<Calendar className="size-4" />}
            />
          )}

          <h3 className="mt-4 text-lg font-semibold">Socials and resume</h3>
          <InfoRow
            label="Portfolio"
            value={
              hacker.personalWebsite ? (
                externalLink(hacker.personalWebsite, "Visit website")
              ) : (
                <EmptyValue />
              )
            }
            icon={<LinkIcon className="size-4" />}
          />
          <InfoRow
            label="LinkedIn"
            value={
              hacker.linkedin ? (
                externalLink(hacker.linkedin, "View profile")
              ) : (
                <EmptyValue />
              )
            }
            icon={<Linkedin className="size-4" />}
          />
          <InfoRow
            label="GitHub"
            value={
              hacker.github ? (
                externalLink(hacker.github, "View profile")
              ) : (
                <EmptyValue />
              )
            }
            icon={<Github className="size-4" />}
          />
          {hacker.xUrl && (
            <InfoRow
              label="X"
              value={externalLink(hacker.xUrl, "View profile")}
              icon={<LinkIcon className="size-4" />}
            />
          )}
          <InfoRow
            label="Resume"
            value={
              hacker.resumeUrl ? (
                externalLink(getResumeUrl(hacker.resumeUrl), "View resume")
              ) : (
                <EmptyValue />
              )
            }
            icon={<FileSpreadsheet className="size-4" />}
          />
          <InfoRow
            label="Share with sponsors"
            value={yesNo(hacker.shareResume)}
            icon={<FileCheck className="size-4" />}
          />

          <h3 className="mt-4 text-lg font-semibold">MLH and travel</h3>
          <InfoRow
            label="MLH Code of Conduct"
            value={agreed(hacker.mlhCheckbox1)}
            icon={<FileCheck className="size-4" />}
          />
          <InfoRow
            label="MLH Privacy Policy and Terms"
            value={agreed(hacker.mlhCheckbox2)}
            icon={<FileCheck className="size-4" />}
          />
          <InfoRow
            label="MLH emails"
            value={agreed(hacker.mlhCheckbox3)}
            icon={<Mail className="size-4" />}
          />
          <InfoRow
            label="Travel reimbursement"
            value={yesNo(hacker.needsTravelReimbursement)}
            icon={<Plane className="size-4" />}
          />
          {hacker.needsTravelReimbursement && (
            <>
              <InfoRow
                label="Amount"
                value={
                  hacker.travelAmount != null ? (
                    `$${hacker.travelAmount} CAD`
                  ) : (
                    <EmptyValue />
                  )
                }
                icon={<Plane className="size-4" />}
              />
              <InfoRow
                label="Travelling from"
                value={hacker.travelFrom || <EmptyValue />}
                icon={<Plane className="size-4" />}
              />
            </>
          )}

          {hacker.applicationType === "normal" && (
            <>
              <h3 className="mt-4 text-lg font-semibold">Short answers</h3>
              <InfoRow
                label={NORMAL_PROMPTS.normalAnswer1}
                value={
                  hacker.shortAnswer1 || (
                    <EmptyValue className="text-base md:text-lg" />
                  )
                }
                icon={<MessageSquare className="size-4" />}
                longAnswer
              />
              <InfoRow
                label={NORMAL_PROMPTS.normalAnswer2}
                value={
                  hacker.shortAnswer2 || (
                    <EmptyValue className="text-base md:text-lg" />
                  )
                }
                icon={<MessageSquare className="size-4" />}
                longAnswer
              />
            </>
          )}

          {team && (
            <>
              <h3 className="mt-4 text-lg font-semibold">Team answers</h3>
              <InfoRow
                label="Team"
                value={team.name}
                icon={<Users className="size-4" />}
              />
              <InfoRow
                label={TEAM_PROMPTS.essay}
                value={
                  team.essay?.trim() || (
                    <EmptyValue className="text-base md:text-lg" />
                  )
                }
                icon={<MessageSquare className="size-4" />}
                longAnswer
              />
              <p className="px-2.5 text-sm text-muted-foreground">
                {TEAM_PROMPTS.mars}
              </p>
              {team.members.map((member) => {
                const isCurrent = member.userId === hacker.userId;
                const name = (
                  <span>
                    {member.name}
                    {isCurrent && (
                      <span className="ml-2 text-xs font-medium text-primary">
                        This applicant
                      </span>
                    )}
                  </span>
                );
                return (
                  <InfoRow
                    key={member.userId}
                    label={
                      linkTeammates && !isCurrent ? (
                        <Link
                          href={`/applications/${member.userId}`}
                          className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                        >
                          {name}
                          <ExternalLink className="size-3.5" />
                        </Link>
                      ) : (
                        name
                      )
                    }
                    value={
                      member.marsAnswer?.trim() || (
                        <EmptyValue className="text-base md:text-lg" />
                      )
                    }
                    icon={<MessageSquare className="size-4" />}
                    longAnswer
                  />
                );
              })}
            </>
          )}

          {!hideBackgroundInfo && (
            <>
              <h3 className="mt-4 text-lg font-semibold">
                Application Details
              </h3>
              <InfoRow
                label="Submission Status"
                value={hacker.submissionStatus || <EmptyValue />}
                icon={<Clock className="size-4" />}
              />
              <InfoRow
                label="Internal Result"
                value={hacker.internalResult || <EmptyValue />}
                icon={<FileCheck className="size-4" />}
              />
              <InfoRow
                label="Created At"
                value={formatDate(hacker.createdAt.toString())}
                icon={<Calendar className="size-4" />}
              />
              <InfoRow
                label="Last Updated"
                value={formatDate(hacker.updatedAt.toString())}
                icon={<Calendar className="size-4" />}
              />
              {hacker.internalNotes && (
                <InfoRow
                  label="Internal Notes"
                  value={hacker.internalNotes}
                  icon={<MessageSquare className="size-4" />}
                />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplicationInfo;
