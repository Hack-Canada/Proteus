import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/auth";

import { db } from "@/lib/db";
import { hackerApplications } from "@/lib/db/schema";
import { mintResumeGrant } from "@/lib/storage/resume-grant";
import { isStoredResumeKey } from "@/lib/storage/s3";
import { isReviewer } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isReviewer(user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { applicationId?: string } | null;
  const applicationId = body?.applicationId;
  if (!applicationId) {
    return NextResponse.json({ message: "Resume not found" }, { status: 404 });
  }

  const [application] = await db
    .select({ resumeUrl: hackerApplications.resumeUrl })
    .from(hackerApplications)
    .where(eq(hackerApplications.id, applicationId));

  const key = application?.resumeUrl || "";
  if (!isStoredResumeKey(key)) {
    return NextResponse.json({ message: "Resume not found" }, { status: 404 });
  }

  const token = mintResumeGrant(key);
  return NextResponse.json({
    url: `/api/resume/open?token=${encodeURIComponent(token)}`,
  });
}
