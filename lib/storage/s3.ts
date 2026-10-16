import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.AWS_SES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export function resumeBucket() {
  const name =
    process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME;
  if (!name) throw new Error("AWS_S3_BUCKET_NAME is not set");
  return name;
}

export function isStoredResumeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  return key.startsWith("resumes/") || key.startsWith("pending/");
}
