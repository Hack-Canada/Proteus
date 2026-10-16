import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import { takeResumeGrant } from "@/lib/storage/resume-grant";
import { isStoredResumeKey, resumeBucket, s3Client } from "@/lib/storage/s3";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const key = takeResumeGrant(token);
  if (!key || !isStoredResumeKey(key)) {
    return NextResponse.json({ message: "Resume not found" }, { status: 404 });
  }

  try {
    const obj = await s3Client.send(
      new GetObjectCommand({ Bucket: resumeBucket(), Key: key }),
    );
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes) {
      return NextResponse.json({ message: "Resume not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error reading resume:", error);
    return NextResponse.json({ message: "Resume not found" }, { status: 404 });
  }
}
