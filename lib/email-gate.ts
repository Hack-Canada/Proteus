export const EMAILS_ENV_KEY = "EMAILS_ENABLED";

export function emailsEnvEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[EMAILS_ENV_KEY] === "true";
}

/** Both gates must be on. A missing database row is off. */
export function emailsMaySend(envOn: boolean, stored: boolean | null | undefined): boolean {
  return envOn && stored === true;
}

function selfCheck() {
  if (emailsEnvEnabled({})) throw new Error("email-gate: unset env must block");
  if (emailsEnvEnabled({ [EMAILS_ENV_KEY]: "false" })) {
    throw new Error("email-gate: false must block");
  }
  if (emailsEnvEnabled({ [EMAILS_ENV_KEY]: "TRUE" })) {
    throw new Error("email-gate: only the exact string true unlocks");
  }
  if (!emailsEnvEnabled({ [EMAILS_ENV_KEY]: "true" })) {
    throw new Error("email-gate: true must unlock");
  }
  if (emailsMaySend(false, true) || emailsMaySend(true, false) || emailsMaySend(true, null)) {
    throw new Error("email-gate: either gate off must block");
  }
  if (!emailsMaySend(true, true)) throw new Error("email-gate: both on must allow");
}

selfCheck();
