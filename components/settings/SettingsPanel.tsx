import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import EventConfigForm, {
  type EventConfigFormValues,
} from "@/components/settings/EventConfigForm";
import {
  DASHBOARD_REVALIDATE_SECONDS,
  MAX_REVIEW_LIMIT,
  MIN_REVIEW_LIMIT,
  RATINGS,
  RESULTS_PER_PAGE,
  REVIEWS_PER_APP,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";

const SETTINGS_INFO = [
  {
    title: "Review Limits",
    description: "Controls how many reviews each organizer can submit.",
    items: [
      {
        label: "Minimum Review Limit",
        value: String(MIN_REVIEW_LIMIT),
        location: "lib/constants.ts",
      },
      {
        label: "Maximum Review Limit",
        value: String(MAX_REVIEW_LIMIT),
        location: "lib/constants.ts",
      },
      {
        label: "Reviews Required per Application",
        value: String(REVIEWS_PER_APP),
        location: "lib/constants.ts",
      },
    ],
  },
  {
    title: "Pagination",
    description: "Controls how many items appear per page in tables.",
    items: [
      {
        label: "Results Per Page",
        value: String(RESULTS_PER_PAGE),
        location: "lib/constants.ts",
      },
    ],
  },
  {
    title: "Dashboard Cache",
    description: "Controls data freshness on the home dashboard.",
    items: [
      {
        label: "Revalidation Interval",
        value: `${DASHBOARD_REVALIDATE_SECONDS} seconds`,
        location: "lib/constants.ts",
      },
    ],
  },
  {
    title: "Rating Scale",
    description: "Application review rating configuration.",
    items: [
      {
        label: "Rating Range",
        value: `${RATINGS[0]} - ${RATINGS[RATINGS.length - 1]}`,
        location: "hooks/useReviewInterface.ts",
      },
    ],
  },
  {
    title: "Email Configuration",
    description: "Email sending is powered by AWS SES.",
    items: [
      {
        label: "Email Provider",
        value: "AWS SES",
        location: "lib/ses/index.ts",
      },
      {
        label: "From Address",
        value: process.env.AWS_SES_NO_REPLY_EMAIL || "AWS_SES_NO_REPLY_EMAIL",
        location: ".env.local",
      },
    ],
  },
  {
    title: "Authentication",
    description: "Auth configuration for the admin portal.",
    items: [
      {
        label: "Session Strategy",
        value: "JWT",
        location: "auth.ts",
      },
      {
        label: "Allowed Roles",
        value: "admin, organizer",
        location: "lib/utils.ts isReviewer",
      },
      {
        label: "Cookie Name",
        value: SESSION_COOKIE_NAME,
        location: "lib/constants.ts",
      },
    ],
  },
];

const SettingsPanel = ({
  config,
  missing,
}: {
  config: EventConfigFormValues | null;
  missing: boolean;
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event config</CardTitle>
          <CardDescription>
            These dates and the phase override are the same row the hacker portal
            reads. Leave the phase on automatic to follow the dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missing ? (
            <p className="text-sm text-muted-foreground">
              This database has no eventConfig table yet. The hacker portal owns
              that table. Point this app at the shared database, or run the portal
              migrations here, then reload.
            </p>
          ) : config ? (
            <EventConfigForm values={config} />
          ) : (
            <EventConfigForm
              values={{
                phase: "",
                registrationOpen: "",
                registrationClose: "",
                eventStart: "",
                eventEnd: "",
                livePhase: "",
                hasRow: false,
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {SETTINGS_INFO.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.location}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SettingsPanel;
