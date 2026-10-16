import type { Metadata } from "next";

export const metadata: Metadata = { title: "Event Config" };

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { getEventConfig, livePhase, toTorontoInput } from "@/lib/event-config";
import { isAdmin } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user?.id || !isAdmin(user.role)) {
    redirect("/");
  }

  const row = await getEventConfig();

  return (
    <Container className="space-y-6 md:space-y-10">
      <PageBanner
        heading="Event Config"
        subheading="Set the dates and phase the hacker portal follows. Code constants below are read-only."
      />
      <SettingsPanel
        missing={row === "missing"}
        config={
          row && row !== "missing"
            ? {
                phase: row.phase ?? "",
                registrationOpen: toTorontoInput(row.registrationOpen),
                registrationClose: toTorontoInput(row.registrationClose),
                eventStart: toTorontoInput(row.eventStart),
                eventEnd: toTorontoInput(row.eventEnd),
                livePhase: livePhase(row),
                hasRow: true,
              }
            : null
        }
      />
    </Container>
  );
}
