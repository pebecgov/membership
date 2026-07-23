import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  buildMemberId,
  isValidNin,
  isValidNigerianPhone,
  normalizePhone,
} from "./utils";

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
    if (!memberIdNumber) throw new Error("Member ID number is required.");
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

    const existingByPhone = await ctx.db
      .query("members")
      .withIndex("byPhone", (q) => q.eq("phone", phone))
      .first();
    if (existingByPhone) {
      throw new Error("This phone number is already registered.");
    }

    const membersInAssoc = await ctx.db
      .query("members")
      .withIndex("byAssociation", (q) => q.eq("associationId", args.associationId))
      .collect();

    const sequence = membersInAssoc.length + 1;
    let generatedId = buildMemberId({
      associationCode: association.code,
      state,
      fullName,
      sequence,
    });

    let suffix = 0;
    while (
      await ctx.db
        .query("members")
        .withIndex("byGeneratedId", (q) => q.eq("generatedId", generatedId))
        .first()
    ) {
      suffix += 1;
      generatedId = buildMemberId({
        associationCode: association.code,
        state,
        fullName,
        sequence: sequence + suffix,
      });
    }

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
      associationName: association.name,
      associationLogoUrl: association.logoUrl,
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
      memberIdNumber: member.memberIdNumber,
      fullName: member.fullName,
      state: member.state,
      associationName: association?.name ?? member.associationCode,
      associationLogoUrl: association?.logoUrl ?? null,
      createdAt: member.createdAt,
    };
  },
});
