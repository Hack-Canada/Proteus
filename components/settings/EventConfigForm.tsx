"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HACKATHON_PHASES } from "@/lib/constants";
import { saveEventConfig, type SaveEventConfigState } from "@/app/(dashboard)/settings/actions";

const PHASE_LABELS: Record<(typeof HACKATHON_PHASES)[number], string> = {
  "pre-registration": "Pre-registration",
  "registration-open": "Registration open",
  "pre-event": "Pre-event",
  "during-event": "During event",
  "post-event": "Post-event",
};

export type EventConfigFormValues = {
  phase: string;
  registrationOpen: string;
  registrationClose: string;
  eventStart: string;
  eventEnd: string;
  livePhase: string;
  hasRow: boolean;
};

const EventConfigForm = ({ values }: { values: EventConfigFormValues }) => {
  const [state, action, pending] = useActionState<SaveEventConfigState, FormData>(
    saveEventConfig,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phase">Phase override</Label>
          <select
            id="phase"
            name="phase"
            defaultValue={values.phase}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Automatic from dates</option>
            {HACKATHON_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {PHASE_LABELS[phase]}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            Live phase right now:{" "}
            <span className="font-medium text-foreground">
              {values.hasRow ? PHASE_LABELS[values.livePhase as keyof typeof PHASE_LABELS] ?? values.livePhase : "not set"}
            </span>
            . The hacker portal picks this up within 30 seconds.
          </p>
        </div>
        <DateField
          id="registrationOpen"
          label="Registration opens"
          defaultValue={values.registrationOpen}
        />
        <DateField
          id="registrationClose"
          label="Registration closes"
          defaultValue={values.registrationClose}
        />
        <DateField id="eventStart" label="Event starts" defaultValue={values.eventStart} />
        <DateField id="eventEnd" label="Event ends" defaultValue={values.eventEnd} />
      </div>
      <p className="text-xs text-muted-foreground">Times are America/Toronto.</p>
      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-primary">Saved. The portal will follow within 30 seconds.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save event config"}
      </Button>
    </form>
  );
};

function DateField({
  id,
  label,
  defaultValue,
}: {
  id: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="datetime-local" required defaultValue={defaultValue} />
    </div>
  );
}

export default EventConfigForm;
