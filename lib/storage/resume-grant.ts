import crypto from "node:crypto";

type Grant = { key: string; exp: number };

// ponytail: one Node process. A restart drops unused links (they last 60s).
// Multiple servers would not share this map; move it to a shared store.
const globalStore = globalThis as typeof globalThis & {
  __resumeGrants?: Map<string, Grant>;
};
const grants = (globalStore.__resumeGrants ??= new Map());
const TTL_MS = 60_000;

function sweep(now: number) {
  for (const [token, grant] of grants) {
    if (grant.exp <= now) grants.delete(token);
  }
}

export function mintResumeGrant(key: string) {
  const now = Date.now();
  sweep(now);
  const token = crypto.randomBytes(24).toString("base64url");
  grants.set(token, { key, exp: now + TTL_MS });
  return token;
}

export function takeResumeGrant(token: string) {
  const grant = grants.get(token);
  if (!grant) return null;
  grants.delete(token);
  if (grant.exp <= Date.now()) return null;
  return grant.key;
}

function selfCheck() {
  const token = mintResumeGrant("resumes/user-1/a.pdf");
  if (takeResumeGrant(token) !== "resumes/user-1/a.pdf") throw new Error("take");
  if (takeResumeGrant(token) !== null) throw new Error("reuse");
  grants.set("expired", { key: "resumes/user-1/a.pdf", exp: Date.now() - 1 });
  if (takeResumeGrant("expired") !== null) throw new Error("expiry");
}

selfCheck();
