import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getAssociationLogoUrl } from "./associationUtils";
import {
  buildMemberId,
  isValidNin,
  isValidNigerianPhone,
  normalizePhone,
} from "./utils";

type DuplicateField = "phone" | "nin" | "network_id" | "association_id";

async function memberToPublicSummary(
  ctx: MutationCtx,
  member: Doc<"members">,
  field: DuplicateField
) {
  const association = await ctx.db.get(member.associationId);
  return {
    status: "already_registered" as const,
    field,
    generatedId: member.generatedId,
    memberIdNumber: member.memberIdNumber ?? null,
    fullName: member.fullName,
    associationName: association?.name ?? member.associationCode,
    associationLogoUrl: association
      ? ((await getAssociationLogoUrl(ctx, association)) ?? "")
      : "",
  };
}

async function checkNoDuplicateRegistration(
  ctx: MutationCtx,
  args: {
    state: string;
    phone: string;
    nin: string;
    memberIdNumber?: string;
    associationId: Id<"associations">;
    associationName: string;
  }
) {
  const memberIdNumber = args.memberIdNumber?.trim().toUpperCase() ?? "";

  const existingByPhone = await ctx.db
    .query("members")
    .withIndex("byPhone", (q) => q.eq("phone", args.phone))
    .first();
  if (existingByPhone) {
    return { ok: false as const, member: existingByPhone, field: "phone" as const };
  }

  const existingByNin = await ctx.db
    .query("members")
    .withIndex("byNin", (q) => q.eq("nin", args.nin))
    .first();
  if (existingByNin) {
    return { ok: false as const, member: existingByNin, field: "nin" as const };
  }

  const generatedId = buildMemberId({
    associationName: args.associationName,
    state: args.state,
    nin: args.nin,
  });

  const existingByGeneratedId = await ctx.db
    .query("members")
    .withIndex("byGeneratedId", (q) => q.eq("generatedId", generatedId))
    .first();
  if (existingByGeneratedId) {
    return {
      ok: false as const,
      member: existingByGeneratedId,
      field: "network_id" as const,
    };
  }

  if (memberIdNumber) {
    const membersInAssociation = await ctx.db
      .query("members")
      .withIndex("byAssociation", (q) => q.eq("associationId", args.associationId))
      .collect();

    const existingByAssociationMemberId = membersInAssociation.find(
      (member) => member.memberIdNumber?.toUpperCase() === memberIdNumber
    );
    if (existingByAssociationMemberId) {
      return {
        ok: false as const,
        member: existingByAssociationMemberId,
        field: "association_id" as const,
      };
    }
  }

  return { ok: true as const, generatedId };
}

export const register = mutation({
  args: {
    fullName: v.string(),
    state: v.string(),
    phone: v.string(),
    nin: v.string(),
    memberIdNumber: v.optional(v.string()),
    associationId: v.id("associations"),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    const state = args.state.trim();
    const phone = normalizePhone(args.phone);
    const nin = args.nin.replace(/\s/g, "");
    const memberIdNumber = args.memberIdNumber?.trim().toUpperCase() ?? "";

    if (!fullName) throw new Error("Name is required.");
    if (!state) throw new Error("State is required.");
    if (!isValidNigerianPhone(phone)) {
      throw new Error("Enter a valid Nigerian phone number.");
    }
    if (!isValidNin(nin)) {
      throw new Error("NIN must be exactly 11 digits.");
    }

    const association = await ctx.db.get(args.associationId);
    if (!association || !association.isActive) {
      throw new Error("Invalid association selected.");
    }

    const duplicateCheck = await checkNoDuplicateRegistration(ctx, {
      state,
      phone,
      nin,
      memberIdNumber: memberIdNumber || undefined,
      associationId: args.associationId,
      associationName: association.name,
    });

    if (!duplicateCheck.ok) {
      return memberToPublicSummary(ctx, duplicateCheck.member, duplicateCheck.field);
    }

    const memberId = await ctx.db.insert("members", {
      fullName,
      state,
      phone,
      nin,
      ...(memberIdNumber ? { memberIdNumber } : {}),
      associationId: args.associationId,
      associationCode: association.code,
      generatedId: duplicateCheck.generatedId,
      phoneVerified: false,
      createdAt: Date.now(),
    });

    return {
      status: "success" as const,
      memberId,
      generatedId: duplicateCheck.generatedId,
      memberIdNumber: memberIdNumber || null,
      associationName: association.name,
      associationLogoUrl: (await getAssociationLogoUrl(ctx, association)) ?? "",
    };
  },
});

export const getByGeneratedId = query({
  args: { generatedId: v.string() },
  handler: async (ctx, { generatedId }) => {
    const member = await ctx.db
      .query("members")
      .withIndex("byGeneratedId", (q) => q.eq("generatedId", generatedId.trim().toUpperCase()))
      .first();

    if (!member) return null;

    const association = await ctx.db.get(member.associationId);
    return {
      generatedId: member.generatedId,
      memberIdNumber: member.memberIdNumber ?? null,
      fullName: member.fullName,
      state: member.state,
      associationName: association?.name ?? member.associationCode,
      associationLogoUrl: association
        ? await getAssociationLogoUrl(ctx, association)
        : null,
      createdAt: member.createdAt,
    };
  },
});

export const verifyMember = query({
  args: { memberId: v.string() },
  handler: async (ctx, { memberId }) => {
    const normalized = memberId.trim().toUpperCase();
    if (!normalized) {
      return { status: "invalid" as const };
    }

    const byNetworkId = await ctx.db
      .query("members")
      .withIndex("byGeneratedId", (q) => q.eq("generatedId", normalized))
      .first();

    if (byNetworkId) {
      const association = await ctx.db.get(byNetworkId.associationId);
      return {
        status: "found" as const,
        member: {
          generatedId: byNetworkId.generatedId,
          memberIdNumber: byNetworkId.memberIdNumber ?? null,
          fullName: byNetworkId.fullName,
          state: byNetworkId.state,
          associationName: association?.name ?? byNetworkId.associationCode,
          associationLogoUrl: association
            ? await getAssociationLogoUrl(ctx, association)
            : null,
          createdAt: byNetworkId.createdAt,
        },
      };
    }

    const byAssociationId = await ctx.db
      .query("members")
      .withIndex("byMemberIdNumber", (q) => q.eq("memberIdNumber", normalized))
      .collect();

    if (byAssociationId.length === 1) {
      const member = byAssociationId[0];
      const association = await ctx.db.get(member.associationId);
      return {
        status: "found" as const,
        member: {
          generatedId: member.generatedId,
          memberIdNumber: member.memberIdNumber ?? null,
          fullName: member.fullName,
          state: member.state,
          associationName: association?.name ?? member.associationCode,
          associationLogoUrl: association
            ? await getAssociationLogoUrl(ctx, association)
            : null,
          createdAt: member.createdAt,
        },
      };
    }

    if (byAssociationId.length > 1) {
      return { status: "ambiguous" as const };
    }

    return { status: "not_found" as const };
  },
});
