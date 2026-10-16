export const hackathonYear = 2027;

// ponytail: display copy only. The real timestamps live in the eventConfig row.
export const eventDatesLabel = "January 8–10, 2027";
export const eventVenue = "University of Toronto";
export const rsvpDeadlineLabel = "January 7th, 2027 at 11:59 PM EST";
export const eventCheckInLabel = "Friday, January 8th, 4:00 PM — 6:30 PM";

export const adminUrl = "https://admin.hackcanada.org";
export const portalUrl = "https://app.hackcanada.org";

const description = `Hack Canada ${hackathonYear} admin. ${eventDatesLabel} at the ${eventVenue}.`;

export const siteConfig = {
  metadataBase: new URL(adminUrl),
  title: "HC Admin",
  description,
  openGraph: {
    title: `Hack Canada ${hackathonYear} Admin`,
    description,
    type: "website" as const,
    locale: "en_CA",
    siteName: "Hack Canada Admin",
  },
  twitter: {
    card: "summary_large_image" as const,
    title: `Hack Canada ${hackathonYear} Admin`,
    description,
  },
};
