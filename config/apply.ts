export const APPLY_TRACKS = ["quick", "normal", "team"] as const;

export type ApplyTrack = (typeof APPLY_TRACKS)[number];

export const TRACKS: {
  id: ApplyTrack;
  title: string;
}[] = [
  { id: "quick", title: "Quick Apps" },
  { id: "normal", title: "Normal Apps" },
  { id: "team", title: "Team Apps" },
];

export function trackLabel(type: string | null | undefined) {
  return TRACKS.find((track) => track.id === type)?.title ?? "Unspecified";
}

export const NORMAL_PROMPTS = {
  normalAnswer1:
    "You get a free plane ticket to anywhere, but you have to leave in one hour. Where are you going and what are you packing?",
  normalAnswer2:
    "Walk us through one of the coolest projects you've built. Talk about whatever you want, but highlight the journey, the key decision you had to make, and how you went about building it. Please provide links to your project if possible.",
} as const;

export const TEAM_PROMPTS = {
  mars: "Your team is sent to Mars but each teammate can only bring one thing. What do each of you bring and why?",
  essay:
    "Tell us about your team and what brought you together. How do you know each other, and why did you decide to participate as a team? We'd love to hear about each member's strengths, areas for growth, and how you complement one another.",
} as const;

export const levelsOfStudy = [
  "Less than Secondary/High School",
  "Secondary/High School",
  "Undergraduate University (2 year - community college or similar)",
  "Undergraduate University (3+ year)",
  "Master's Degree",
  "Professional Degree (MD, JD, etc)",
  "Doctoral Degree (PhD, EdD, etc)",
  "Postdoctoral Studies",
  "Code School/Bootcamp",
  "Online Certification Program",
  "Other Vocational/Trade Program or Apprenticeship",
  "Self-taught/Independent Learning",
  "I'm not currently a student",
  "Other",
  "Prefer not to answer",
];
