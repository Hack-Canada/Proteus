import { trackLabel } from "@/config/apply";
import { db } from "@/lib/db";
import { hackerApplications } from "@/lib/db/schema";
import { and, count, eq, sql } from "drizzle-orm";

const ApplicationTypeData = async () => {
  const [tracks, [travel]] = await Promise.all([
    db
      .select({
        applicationType: hackerApplications.applicationType,
        applicants: sql<number>`COUNT(${hackerApplications.userId})`,
      })
      .from(hackerApplications)
      .where(eq(hackerApplications.submissionStatus, "submitted"))
      .groupBy(hackerApplications.applicationType)
      .orderBy(sql`COUNT(${hackerApplications.userId}) DESC`),
    db
      .select({ count: count() })
      .from(hackerApplications)
      .where(
        and(
          eq(hackerApplications.submissionStatus, "submitted"),
          eq(hackerApplications.needsTravelReimbursement, true),
        ),
      ),
  ]);

  const total = tracks.reduce((sum, row) => sum + row.applicants, 0);

  return (
    <div className="overflow-hidden rounded-lg border p-6 md:col-span-2 md:p-10">
      <p className="text-lg font-semibold">Application type</p>
      <p className="mb-6 text-sm text-muted-foreground">
        Submitted applications by track. {travel.count} asked for travel
        reimbursement.
      </p>
      <div className="space-y-3">
        {tracks.map(({ applicationType, applicants }) => {
          const pct = total > 0 ? ((applicants / total) * 100).toFixed(1) : "0";
          return (
            <div key={applicationType ?? "none"} className="flex items-center gap-3">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="flex-1 truncate text-sm">
                {trackLabel(applicationType)}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {applicants} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationTypeData;
