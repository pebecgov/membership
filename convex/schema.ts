import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  associations: defineTable({
    name: v.string(),
    /** Short code used in generated IDs, e.g. NACCIMA */
    code: v.string(),
    logoUrl: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("byCode", ["code"])
    .index("byActive", ["isActive"]),

  members: defineTable({
    fullName: v.string(),
    state: v.string(),
    phone: v.string(),
    nin: v.string(),
    memberIdNumber: v.optional(v.string()),
    associationId: v.id("associations"),
    associationCode: v.string(),
    generatedId: v.string(),
    phoneVerified: v.boolean(),
    createdAt: v.number(),
  })
    .index("byGeneratedId", ["generatedId"])
    .index("byPhone", ["phone"])
    .index("byMemberIdNumber", ["memberIdNumber"])
    .index("byAssociation", ["associationId"]),

  otp_sessions: defineTable({
    phone: v.string(),
    code: v.optional(v.string()),
    twilioVerificationSid: v.optional(v.string()),
    verified: v.boolean(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  }).index("byPhone", ["phone"]),

  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),
});
