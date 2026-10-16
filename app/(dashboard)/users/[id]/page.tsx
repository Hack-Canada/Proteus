import type { Metadata } from "next";

export const metadata: Metadata = { title: "User" };

import { getCurrentUser } from "@/auth";
import Container from "@/components/Container";
import PageBanner from "@/components/PageBanner";
import UserActions from "@/components/UserActions";
import UserInfo from "@/components/UserInfo";
import UserReviewHistory from "@/components/UserReviewHistory";
import { getUserById } from "@/data/user";
import { getTeamForUser } from "@/data/teams";
import { db } from "@/lib/db";
import { checkIns, rsvp } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import React from "react";

const UserPage = async (
  props: {
    params: Promise<{
      id: string;
    }>;
  }
) => {
  const params = await props.params;
  const { id } = params;
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "admin") {
    redirect("https://app.hackcanada.org/login");
  }

  const [user, team, checkedInRows, rsvpRows] = await Promise.all([
    getUserById(id),
    getTeamForUser(id),
    db
      .select({ id: checkIns.id })
      .from(checkIns)
      .where(and(eq(checkIns.userId, id), eq(checkIns.eventName, "hackathon-check-in")))
      .limit(1),
    db
      .select({
        dietaryRestrictions: rsvp.dietaryRestrictions,
        tshirtSize: rsvp.tshirtSize,
      })
      .from(rsvp)
      .where(eq(rsvp.userId, id))
      .limit(1),
  ]);

  if (!user) {
    return null;
  }

  return (
    <Container className="space-y-6 md:space-y-8">
      <PageBanner
        name={user.name.split(" ")[0]}
        subheading={`More information on the user. This is a dedicated page for users of all kinds as long as they have an account with us.`}
        backButton
      />
      <div className="flex space-y-6 max-xl:flex-col md:space-y-8 xl:space-x-8 xl:space-y-0">
        <div className="w-full space-y-6 md:space-y-8 xl:max-w-screen-md">
          <UserInfo
            user={user}
            team={team}
            checkedIn={checkedInRows.length > 0}
            rsvpDetails={rsvpRows[0] ?? null}
          />
          <UserReviewHistory userId={user.id} />
        </div>
        {user && (
          <UserActions
            id={user.id}
            name={user.name.split(" ")[0]}
            email={user.email}
            status={user.applicationStatus as ApplicationStatus}
          />
        )}
      </div>
    </Container>
  );
};

export default UserPage;
