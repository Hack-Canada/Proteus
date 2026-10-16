import { eq } from "drizzle-orm";
import { z } from "zod";

import { HACKATHON_PHASES, type HackathonPhase } from "@/lib/constants";
import { db } from "@/lib/db";
import { eventConfig, type EventConfig } from "@/lib/db/schema";

const TZ = "America/Toronto";

export function toTorontoInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function wallClockUtc(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = get("hour") === 24 ? 0 : get("hour");
  return Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"));
}

export function fromTorontoInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid datetime");
  const wanted = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let ts = wanted;
  for (let i = 0; i < 3; i++) ts = wanted - (wallClockUtc(ts) - wanted);
  return new Date(ts);
}

export function phaseFromDates(
  now: Date,
  dates: {
    registrationOpen: Date;
    registrationClose: Date;
    eventStart: Date;
    eventEnd: Date;
  },
): HackathonPhase {
  const current = now.getTime();
  if (current < dates.registrationOpen.getTime()) return "pre-registration";
  if (current < dates.registrationClose.getTime()) return "registration-open";
  if (current < dates.eventStart.getTime()) return "pre-event";
  if (current < dates.eventEnd.getTime()) return "during-event";
  return "post-event";
}

export function livePhase(row: EventConfig, now = new Date()): HackathonPhase {
  if (row.phase && (HACKATHON_PHASES as readonly string[]).includes(row.phase)) {
    return row.phase as HackathonPhase;
  }
  return phaseFromDates(now, row);
}

const eventConfigSchema = z
  .object({
    phase: z.enum(HACKATHON_PHASES).nullable(),
    registrationOpen: z.date(),
    registrationClose: z.date(),
    eventStart: z.date(),
    eventEnd: z.date(),
  })
  .superRefine((value, ctx) => {
    if (!(value.registrationOpen < value.registrationClose)) {
      ctx.addIssue({
        code: "custom",
        message: "Registration must open before it closes.",
      });
    }
    if (!(value.registrationClose <= value.eventStart)) {
      ctx.addIssue({
        code: "custom",
        message: "Registration must close before the event starts.",
      });
    }
    if (!(value.eventStart < value.eventEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "The event must start before it ends.",
      });
    }
  });

export type ParsedEventConfig = z.infer<typeof eventConfigSchema>;

export function parseEventConfig(
  input: unknown,
): { ok: true; data: ParsedEventConfig } | { ok: false; error: string } {
  const raw = z
    .object({
      phase: z.string().nullable().optional(),
      registrationOpen: z.string(),
      registrationClose: z.string(),
      eventStart: z.string(),
      eventEnd: z.string(),
    })
    .safeParse(input);
  if (!raw.success) return { ok: false, error: "Fill in all four dates." };

  let dates: ParsedEventConfig;
  try {
    dates = {
      phase: raw.data.phase ? (raw.data.phase as HackathonPhase) : null,
      registrationOpen: fromTorontoInput(raw.data.registrationOpen),
      registrationClose: fromTorontoInput(raw.data.registrationClose),
      eventStart: fromTorontoInput(raw.data.eventStart),
      eventEnd: fromTorontoInput(raw.data.eventEnd),
    };
  } catch {
    return { ok: false, error: "Dates must be valid Toronto date and time values." };
  }

  const parsed = eventConfigSchema.safeParse(dates);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid config." };
  }
  return { ok: true, data: parsed.data };
}

function isMissingTable(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
  return text.includes("42P01") || /eventConfig/i.test(text) && /does not exist|relation/i.test(text);
}

export async function getEventConfig(): Promise<EventConfig | null | "missing"> {
  try {
    const [row] = await db
      .select()
      .from(eventConfig)
      .where(eq(eventConfig.id, "default"))
      .limit(1);
    return row ?? null;
  } catch (error) {
    if (isMissingTable(error)) return "missing";
    throw error;
  }
}

function selfCheck() {
  const bad = parseEventConfig({
    phase: null,
    registrationOpen: "2027-02-01T00:00",
    registrationClose: "2027-01-01T00:00",
    eventStart: "2027-03-01T00:00",
    eventEnd: "2027-03-03T00:00",
  });
  if (bad.ok) throw new Error("event-config: expected date order to fail");

  const good = parseEventConfig({
    phase: "",
    registrationOpen: "2027-01-05T00:00",
    registrationClose: "2027-01-07T23:59",
    eventStart: "2027-01-08T16:00",
    eventEnd: "2027-01-10T16:00",
  });
  if (!good.ok) throw new Error(`event-config: ${good.error}`);
  if (toTorontoInput(good.data.eventStart) !== "2027-01-08T16:00") {
    throw new Error(`event-config: toronto roundtrip ${toTorontoInput(good.data.eventStart)}`);
  }
  if (good.data.phase !== null) throw new Error("event-config: empty phase should be automatic");
  const automatic = phaseFromDates(new Date("2027-01-09T12:00:00-05:00"), good.data);
  if (automatic !== "during-event") throw new Error(`event-config: phase ${automatic}`);
}

selfCheck();
