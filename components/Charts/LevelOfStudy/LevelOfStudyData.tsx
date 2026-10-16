import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { hackerApplications } from "@/lib/db/schema";
import LevelOfStudyBarChart from "./LevelOfStudyBarChart";

type Props = {};

const LevelOfStudyData = async ({}: Props) => {
  const results = await db
    .select({
      level: hackerApplications.levelOfStudy,
      applicants: sql<number>`COUNT(${hackerApplications.userId})`,
    })
    .from(hackerApplications)
    .where(eq(hackerApplications.submissionStatus, "submitted"))
    .groupBy(hackerApplications.levelOfStudy)
    .execute();

  return (
    <div className="row-span-2 overflow-hidden rounded-lg border p-6 md:col-span-2 md:p-10">
      <LevelOfStudyBarChart data={results} />
    </div>
  );
};
export default LevelOfStudyData;
