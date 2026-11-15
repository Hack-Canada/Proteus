"use client";

import { useActionState } from "react";

import {
  setEmailSwitch,
  type SaveEmailSwitchState,
} from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { EMAILS_ENV_KEY } from "@/lib/email-gate";

const EmailSwitchForm = ({
  enabled,
  envEnabled,
}: {
  enabled: boolean;
  envEnabled: boolean;
}) => {
  const [state, action, pending] = useActionState<SaveEmailSwitchState, FormData>(
    setEmailSwitch,
    null,
  );
  const on = state?.ok ? state.enabled : enabled;

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Turn the email switch on, send the emails, then turn it off. Acceptance,
        rejection, and campaigns all stay silent while it is off. Decisions are
        still saved.
      </p>
      <p className="text-sm">
        Environment key <span className="font-mono">{EMAILS_ENV_KEY}</span> is{" "}
        <span className="font-medium">{envEnabled ? "true" : "not set"}</span>.
        {envEnabled
          ? " The switch below still has to be on."
          : " Leave it unset and this portal cannot send any email, even if the switch is on. Set it to the exact value true only on a process that should be able to send."}
      </p>
      <p className="text-sm">
        Switch is <span className="font-medium">{on ? "on" : "off"}</span>.
        {on ? "" : " No row, or a row that is off, means off."}
      </p>
      <input type="hidden" name="emailsEnabled" value={on ? "false" : "true"} />
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-primary">
          {state.enabled
            ? "Saved. Emails can go out. Send what you need, then turn this off."
            : "Saved. Emails are off."}
        </p>
      )}
      <Button type="submit" variant={on ? "destructive" : "default"} disabled={pending}>
        {pending ? "Saving..." : on ? "Turn emails off" : "Turn emails on"}
      </Button>
    </form>
  );
};

export default EmailSwitchForm;
