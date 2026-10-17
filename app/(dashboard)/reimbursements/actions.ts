"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/auth";
import { TRAVEL_CAP } from "@/lib/travel";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/db/queries/audit-log";
import { hackerApplications, teamMembers } from "@/lib/db/schema";
import { isAdmin } from "@/lib/utils";

export type SaveTravelState = { ok: false; error: string } | null;

const itemSchema = z
  .object({
    userId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    amount: z.string(),
  })
  .superRefine((item, ctx) => {
    if (item.decision === "rejected") return;
    if (!/^\d+$/.test(item.amount)) {
      ctx.addIssue({ code: "custom", message: "Enter a whole dollar amount." });
      return;
    }
    const amount = Number(item.amount);
    if (amount > TRAVEL_CAP) {
      ctx.addIssue({
        code: "custom",
        message: `Approved amount cannot exceed $${TRAVEL_CAP}.`,
      });
    }
  });

function readItems(formData: FormData) {
  const userIds = formData.getAll("userId").map(String);
  const decisions = formData.getAll("decision").map(String);
  const amounts = formData.getAll("amount").map(String);
  if (
    userIds.length === 0 ||
    userIds.length !== decisions.length ||
    userIds.length !== amounts.length
  ) {
    return { ok: false as const, error: "Choose yes or no for each person." };
  }
  if (new Set(userIds).size !== userIds.length) {
    return { ok: false as const, error: "Duplicate people in this review." };
  }
  if (decisions.some((decision) => decision !== "approved" && decision !== "rejected")) {
    return { ok: false as const, error: "Choose yes or no for each person." };
  }
  const parsed = z.array(itemSchema).safeParse(
    userIds.map((userId, index) => ({
      userId,
      decision: decisions[index],
      amount: amounts[index],
    })),
  );
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the amounts and try again.",
    };
  }
  return { ok: true as const, items: parsed.data };
}

export async function saveTravelDecisions(
  _prev: SaveTravelState,
  formData: FormData,
): Promise<SaveTravelState> {
  const user = await getCurrentUser();
  const reviewerId = user?.id;
  if (!reviewerId || !user || !isAdmin(user.role)) {
    return { ok: false, error: "Only admins can decide travel reimbursement." };
  }

  const parsed = readItems(formData);
  if (!parsed.ok) return parsed;

  const ids = parsed.items.map((item) => item.userId);
  const existing = await db
    .select({
      userId: hackerApplications.userId,
      travelDecision: hackerApplications.travelDecision,
      travelApprovedAmount: hackerApplications.travelApprovedAmount,
      submissionStatus: hackerApplications.submissionStatus,
      needsTravelReimbursement: hackerApplications.needsTravelReimbursement,
    })
    .from(hackerApplications)
    .where(inArray(hackerApplications.userId, ids));

  if (existing.length !== ids.length) {
    return { ok: false, error: "One of these applications could not be found." };
  }
  if (
    existing.some(
      (row) => row.submissionStatus !== "submitted" || !row.needsTravelReimbursement,
    )
  ) {
    return { ok: false, error: "Only submitted travel requests can be decided." };
  }

  if (ids.length > 1) {
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(inArray(teamMembers.userId, ids));
    const teamIds = new Set(memberships.map((membership) => membership.teamId));
    if (memberships.length !== ids.length || teamIds.size !== 1) {
      return { ok: false, error: "A team review can only include that team." };
    }
  }

  const byUser = new Map(existing.map((row) => [row.userId, row]));
  const reviewedAt = new Date();

  await db.transaction(async (tx) => {
    for (const item of parsed.items) {
      const previous = byUser.get(item.userId);
      const approvedAmount = item.decision === "approved" ? Number(item.amount) : null;
      await tx
        .update(hackerApplications)
        .set({
          travelDecision: item.decision,
          travelApprovedAmount: approvedAmount,
          travelReviewedBy: reviewerId,
          travelReviewedAt: reviewedAt,
        })
        .where(
          and(
            eq(hackerApplications.userId, item.userId),
            eq(hackerApplications.submissionStatus, "submitted"),
            eq(hackerApplications.needsTravelReimbursement, true),
          ),
        );
      await createAuditLog(
        {
          userId: reviewerId,
          action: "update",
          entityType: "travelReimbursement",
          entityId: item.userId,
          previousValue: {
            travelDecision: previous?.travelDecision ?? null,
            travelApprovedAmount: previous?.travelApprovedAmount ?? null,
          },
          newValue: {
            travelDecision: item.decision,
            travelApprovedAmount: approvedAmount,
          },
        },
        tx,
      );
    }
  });

  revalidatePath("/reimbursements");
  revalidatePath("/reimbursements/review");
  revalidatePath("/");

  const focusUserId = String(formData.get("focusUserId") ?? ids[0]);
  if (formData.get("intent") === "continue") redirect("/reimbursements/review");
  redirect(`/reimbursements/review?userId=${focusUserId}`);
}
