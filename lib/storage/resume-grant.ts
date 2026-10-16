import crypto from "node:crypto";

// Reviewers keep the application open and re-open the PDF. A signed token
// stays valid across serverless instances; an in-memory grant would not.
const TTL_MS = 3 * 60 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function mintResumeGrant(key: string) {
  const payload = Buffer.from(
    JSON.stringify({ key, exp: Date.now() + TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function takeResumeGrant(token: string) {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const actualBytes = Buffer.from(sig);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  let body: { key?: unknown; exp?: unknown };
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (typeof body.key !== "string" || typeof body.exp !== "number") return null;
  if (body.exp <= Date.now()) return null;
  return body.key;
}

function selfCheck() {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET ??= "resume-grant-self-check";
  try {
    const token = mintResumeGrant("resumes/user-1/a.pdf");
    if (takeResumeGrant(token) !== "resumes/user-1/a.pdf") throw new Error("read");
    if (takeResumeGrant(token) !== "resumes/user-1/a.pdf") throw new Error("reuse");
    if (takeResumeGrant(`${token}x`) !== null) throw new Error("tamper");

    const payload = Buffer.from(
      JSON.stringify({ key: "resumes/user-1/a.pdf", exp: Date.now() - 1 }),
    ).toString("base64url");
    if (takeResumeGrant(`${payload}.${sign(payload)}`) !== null) {
      throw new Error("expiry");
    }
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
}

selfCheck();
