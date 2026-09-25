import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  associations: defineTable({
    name: v.string(),
    /** Short code used in generated IDs, e.g. NACCIMA */
    code: v.string(),
    /** Legacy external logo URL (seed data / old records) */
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
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
    /** Denormalized text for admin search, filled on write and by stats rebuild */
    searchText: v.optional(v.string()),
  })
    .index("byGeneratedId", ["generatedId"])
    .index("byPhone", ["phone"])
    .index("byNin", ["nin"])
    .index("byMemberIdNumber", ["memberIdNumber"])
    .index("byAssociation", ["associationId"])
    .index("byCreatedAt", ["createdAt"])
    .index("byAssociationCreatedAt", ["associationId", "createdAt"])
    .index("byStateCreatedAt", ["state", "createdAt"])
    .searchIndex("search_members", {
      searchField: "searchText",
      filterFields: ["associationId", "state"],
    }),

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

  viewer_access: defineTable({
    email: v.string(),
    associationIds: v.array(v.id("associations")),
    updatedAt: v.number(),
  }).index("byEmail", ["email"]),

  /** Denormalized counts so the dashboard never scans every member. */
  dashboard_stats: defineTable({
    key: v.string(),
    total: v.number(),
    byState: v.array(v.object({ name: v.string(), count: v.number() })),
    byAssociation: v.array(v.object({ id: v.string(), count: v.number() })),
    daily: v.array(v.object({ date: v.string(), count: v.number() })),
    ready: v.boolean(),
    rebuilding: v.boolean(),
    updatedAt: v.number(),
  }).index("byKey", ["key"]),
});
