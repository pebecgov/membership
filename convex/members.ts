import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getAssociationLogoUrl } from "./associationUtils";
import {
  buildMemberId,
  isValidNin,
  isValidNigerianPhone,
  normalizePhone,
} from "./utils";

async function assertNoDuplicateRegistration(
  ctx: MutationCtx,
  args: {
    fullName: string;
    state: string;
    phone: string;
    nin: string;
    memberIdNumber: string;
    associationId: Id<"associations">;
    associationName: string;
  }
) {
  const fullName = args.fullName.trim();
  const normalizedName = fullName.toLowerCase();
  const memberIdNumber = args.memberIdNumber.trim().toUpperCase();

  const existingByPhone = await ctx.db
    .query("members")
    .withIndex("byPhone", (q) => q.eq("phone", args.phone))
    .first();
  if (existingByPhone) {
    throw new Error("This phone number is already registered.");
  }

  const existingByNin = await ctx.db
    .query("members")
    .withIndex("byNin", (q) => q.eq("nin", args.nin))
    .first();
  if (existingByNin) {
    throw new Error("This NIN is already registered.");
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
    throw new Error(
      "A member with this membership ID already exists. If you believe this is an error, contact support."
    );
  }

  const membersInAssociation = await ctx.db
    .query("members")
    .withIndex("byAssociation", (q) => q.eq("associationId", args.associationId))
    .collect();

  const existingByAssociationMemberId = membersInAssociation.find(
    (member) => member.memberIdNumber?.toUpperCase() === memberIdNumber
  );
  if (existingByAssociationMemberId) {
    throw new Error("This association member ID is already registered.");
  }

  const exactDuplicate = membersInAssociation.find(
    (member) =>
      member.fullName.trim().toLowerCase() === normalizedName &&
      member.state === args.state &&
      member.phone === args.phone &&
      member.nin === args.nin &&
      member.memberIdNumber?.toUpperCase() === memberIdNumber
  );

  if (exactDuplicate) {
    throw new Error("A registration with these exact details already exists.");
  }

  return generatedId;
}

export const register = mutation({
  args: {
    fullName: v.string(),
    state: v.string(),
    phone: v.string(),
    nin: v.string(),
    memberIdNumber: v.string(),
    associationId: v.id("associations"),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    const state = args.state.trim();
    const phone = normalizePhone(args.phone);
    const nin = args.nin.replace(/\s/g, "");
    const memberIdNumber = args.memberIdNumber.trim().toUpperCase();

    if (!fullName) throw new Error("Name is required.");
    if (!state) throw new Error("State is required.");
    if (!memberIdNumber) throw new Error("Association member ID is required.");
    if (!isValidNigerianPhone(phone)) {
      throw new Error("Enter a valid Nigerian phone number.");
    }
    if (!isValidNin(nin)) {
      throw new Error("NIN must be exactly 11 digits.");
    }

    const otpSession = await ctx.db
      .query("otp_sessions")
      .withIndex("byPhone", (q) => q.eq("phone", phone))
      .order("desc")
      .first();

    if (!otpSession?.verified || otpSession.expiresAt < Date.now()) {
      throw new Error("Phone number is not verified. Complete OTP first.");
    }

    const association = await ctx.db.get(args.associationId);
    if (!association || !association.isActive) {
      throw new Error("Invalid association selected.");
    }

    const generatedId = await assertNoDuplicateRegistration(ctx, {
      fullName,
      state,
      phone,
      nin,
      memberIdNumber,
      associationId: args.associationId,
      associationName: association.name,
    });

    const memberId = await ctx.db.insert("members", {
      fullName,
      state,
      phone,
      nin,
      memberIdNumber,
      associationId: args.associationId,
      associationCode: association.code,
      generatedId,
      phoneVerified: true,
      createdAt: Date.now(),
    });

    return {
      memberId,
      generatedId,
      memberIdNumber,
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
      .withIndex("byGeneratedId", (q) => q.eq("generatedId", generatedId))
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
