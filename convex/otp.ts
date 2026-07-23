import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isValidNigerianPhone, normalizePhone } from "./utils";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Local OTP — replace with Twilio SMS when credentials are configured. */
export const sendOtp = mutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalized = normalizePhone(phone);
    if (!isValidNigerianPhone(normalized)) {
      throw new Error("Enter a valid Nigerian phone number.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    await ctx.db.insert("otp_sessions", {
      phone: normalized,
      code,
      verified: false,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      createdAt: now,
    });

    console.log(`[OTP] ${normalized}: ${code}`);
    return { success: true, phone: normalized, devCode: code };
  },
});

export const verifyOtp = mutation({
  args: { phone: v.string(), code: v.string() },
  handler: async (ctx, { phone, code }) => {
    const normalized = normalizePhone(phone);
    const session = await ctx.db
      .query("otp_sessions")
      .withIndex("byPhone", (q) => q.eq("phone", normalized))
      .order("desc")
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("OTP expired. Request a new code.");
    }
    if (session.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Request a new code.");
    }
    if (session.code !== code.trim()) {
      await ctx.db.patch(session._id, { attempts: session.attempts + 1 });
      throw new Error("Invalid OTP.");
    }

    await ctx.db.patch(session._id, { verified: true });
    return { verified: true };
  },
});

export const isPhoneVerified = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalized = normalizePhone(phone);
    const session = await ctx.db
      .query("otp_sessions")
      .withIndex("byPhone", (q) => q.eq("phone", normalized))
      .order("desc")
      .first();

    if (!session?.verified) return false;
    return session.expiresAt > Date.now();
  },
});
