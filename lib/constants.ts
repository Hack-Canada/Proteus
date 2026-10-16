export const RESULTS_PER_PAGE = 25;
export const MIN_REVIEW_LIMIT = 50;
export const MAX_REVIEW_LIMIT = Math.ceil(MIN_REVIEW_LIMIT * 3.5);
export const REVIEWS_PER_APP = 5;
export const RATINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const MAX_TEAM_SIZE = 4;
// Must match `export const revalidate` on the home page. Next cannot import it there.
export const DASHBOARD_REVALIDATE_SECONDS = 60;
export const SESSION_COOKIE_NAME = "authjs.session-token-admin";

export const HACKATHON_PHASES = [
  "pre-registration",
  "registration-open",
  "pre-event",
  "during-event",
  "post-event",
] as const;

export type HackathonPhase = (typeof HACKATHON_PHASES)[number];

export type NavigationLink = {
  name: string;
  href: string;
  adminOnly?: boolean;
  roles?: string[];
};

export type NavSection = {
  label: string;
  links: NavigationLink[];
};

export const navSections: NavSection[] = [
  {
    label: "Overview",
    links: [
      { name: "Home", href: "/" },
      { name: "Statistics", href: "/statistics", roles: ["admin", "organizer"] },
    ],
  },
  {
    label: "Applications",
    links: [
      { name: "Review", href: "/review-applications" },
      { name: "Applications", href: "/applications", adminOnly: true },
      { name: "Teams", href: "/teams", adminOnly: true },
      { name: "Reimbursements", href: "/reimbursements", adminOnly: true },
      { name: "Decisions", href: "/review-applications/decisions", adminOnly: true },
      { name: "Emails", href: "/emails", adminOnly: true },
    ],
  },
  {
    label: "Event",
    links: [
      { name: "RSVPs", href: "/rsvps", adminOnly: true },
      { name: "Check-ins", href: "/check-ins", adminOnly: true },
      { name: "Schedule", href: "/schedule", adminOnly: true },
      { name: "Challenges", href: "/challenges", adminOnly: true },
      { name: "Points", href: "/points-management", adminOnly: true },
      { name: "Shop", href: "/shop", adminOnly: true },
      { name: "Banners", href: "/banners", adminOnly: true },
    ],
  },
  {
    label: "People",
    links: [
      { name: "Users", href: "/users", adminOnly: true },
      { name: "Roles", href: "/role-management", adminOnly: true },
      { name: "Reviewer Stats", href: "/reviewers", adminOnly: true },
      { name: "Leaderboards", href: "/reviewers/leaderboards" },
    ],
  },
  {
    label: "System",
    links: [
      { name: "Event Config", href: "/settings", adminOnly: true },
      { name: "Logs", href: "/logs", adminOnly: true },
    ],
  },
];

export const navLinks = navSections.flatMap((section) => section.links);
