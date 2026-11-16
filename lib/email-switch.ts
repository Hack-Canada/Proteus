import { eq, sql } from "drizzle-orm";

import { emailsEnvEnabled, emailsMaySend } from "@/lib/email-gate";
import { db } from "@/lib/db";
import { portalSettings } from "@/lib/db/schema";

const ROW_ID = "emails";

export type EmailSwitchState = {
  enabled: boolean;
  envEnabled: boolean;
};

function isMissingTable(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
  return text.includes("42P01") || (/portalSettings/i.test(text) && /does not exist|relation/i.test(text));
}

async function readStored(): Promise<boolean | null> {
  try {
    const [row] = await db
      .select({ emailsEnabled: portalSettings.emailsEnabled })
      .from(portalSettings)
      .where(eq(portalSettings.id, ROW_ID))
      .limit(1);
    if (!row) return null;
    return row.emailsEnabled === true;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function getEmailSwitch(): Promise<EmailSwitchState> {
  const envEnabled = emailsEnvEnabled();
  const enabled = (await readStored()) === true;
  return { enabled, envEnabled };
}

export async function canSendEmail(): Promise<{ ok: true } | { ok: false; error: string }> {
  const envOn = emailsEnvEnabled();
  const stored = envOn ? await readStored() : false;
  if (emailsMaySend(envOn, stored)) return { ok: true };
  if (!envOn) {
    return {
      ok: false,
      error:
        "Emails are off. Set EMAILS_ENABLED=true in the environment. Without that, this portal cannot send email.",
    };
  }
  return {
    ok: false,
    error:
      "Emails are off. Turn the email switch on in Settings, send the emails, then turn it off.",
  };
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "portalSettings" (
      "id" text PRIMARY KEY,
      "emailsEnabled" boolean NOT NULL DEFAULT false,
      "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function saveEmailSwitch(enabled: boolean) {
  const previous = await readStored();
  await ensureTable();
  const updatedAt = new Date();
  await db
    .insert(portalSettings)
    .values({ id: ROW_ID, emailsEnabled: enabled, updatedAt })
    .onConflictDoUpdate({
      target: portalSettings.id,
      set: { emailsEnabled: enabled, updatedAt },
    });
  return { previous, existed: previous !== null, enabled };
}
