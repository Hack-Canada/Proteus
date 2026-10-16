"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/auth";
import { getEventConfig, parseEventConfig } from "@/lib/event-config";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/db/queries/audit-log";
import { eventConfig } from "@/lib/db/schema";
import { isAdmin } from "@/lib/utils";

export type SaveEventConfigState = { ok: true } | { ok: false; error: string } | null;

export async function saveEventConfig(
  _prev: SaveEventConfigState,
  formData: FormData,
): Promise<SaveEventConfigState> {
  const user = await getCurrentUser();
  if (!user?.id || !isAdmin(user.role)) {
    return { ok: false, error: "Only admins can change event config." };
  }

  const parsed = parseEventConfig({
    phase: String(formData.get("phase") ?? ""),
    registrationOpen: String(formData.get("registrationOpen") ?? ""),
    registrationClose: String(formData.get("registrationClose") ?? ""),
    eventStart: String(formData.get("eventStart") ?? ""),
    eventEnd: String(formData.get("eventEnd") ?? ""),
  });
  if (!parsed.ok) return parsed;

  const previous = await getEventConfig();
  if (previous === "missing") {
    return {
      ok: false,
      error: "The eventConfig table is not in this database yet.",
    };
  }

  const row = {
    id: "default",
    phase: parsed.data.phase,
    registrationOpen: parsed.data.registrationOpen,
    registrationClose: parsed.data.registrationClose,
    eventStart: parsed.data.eventStart,
    eventEnd: parsed.data.eventEnd,
    updatedAt: new Date(),
  };

  await db
    .insert(eventConfig)
    .values(row)
    .onConflictDoUpdate({
      target: eventConfig.id,
      set: {
        phase: row.phase,
        registrationOpen: row.registrationOpen,
        registrationClose: row.registrationClose,
        eventStart: row.eventStart,
        eventEnd: row.eventEnd,
        updatedAt: row.updatedAt,
      },
    });

  await createAuditLog({
    userId: user.id,
    action: previous ? "update" : "create",
    entityType: "eventConfig",
    entityId: "default",
    previousValue: previous,
    newValue: row,
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
