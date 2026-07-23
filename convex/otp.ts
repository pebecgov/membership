import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { isValidNigerianPhone, normalizePhone } from "./utils";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function twilioAuthHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio credentials are not configured.");
  }
  return `Basic ${btoa(`${sid}:${token}`)}`;
}

/** Send OTP via Twilio Verify API */
export const sendOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalized = normalizePhone(phone);
    if (!isValidNigerianPhone(normalized)) {
      throw new Error("Enter a valid Nigerian phone number (11 digits).");
    }

    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) {
      throw new Error("TWILIO_VERIFY_SERVICE_SID is not set.");
    }

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: normalized,
          Channel: "sms",
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Twilio Verify error:", data);
      throw new Error(data.message ?? "Failed to send OTP.");
    }

    await ctx.runMutation(internal.otp.storeSession, {
      phone: normalized,
      twilioVerificationSid: data.sid,
    });

    return { success: true, phone: normalized };
  },
});

/** Verify OTP code via Twilio Verify API */
export const verifyOtp = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { phone, code }) => {
    const normalized = normalizePhone(phone);
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) {
      throw new Error("TWILIO_VERIFY_SERVICE_SID is not set.");
    }

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: normalized,
          Code: code.trim(),
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.status !== "approved") {
      await ctx.runMutation(internal.otp.recordFailedAttempt, { phone: normalized });
      throw new Error("Invalid or expired OTP.");
    }

    await ctx.runMutation(internal.otp.markVerified, { phone: normalized });
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

export const storeSession = internalMutation({
  args: {
    phone: v.string(),
    twilioVerificationSid: v.optional(v.string()),
  },
  handler: async (ctx, { phone, twilioVerificationSid }) => {
    const now = Date.now();
    await ctx.db.insert("otp_sessions", {
      phone,
      twilioVerificationSid,
      verified: false,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      createdAt: now,
    });
  },
});

export const markVerified = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const session = await ctx.db
      .query("otp_sessions")
      .withIndex("byPhone", (q) => q.eq("phone", phone))
      .order("desc")
      .first();

    if (!session) {
      throw new Error("OTP session not found.");
    }

    await ctx.db.patch(session._id, {
      verified: true,
      expiresAt: Date.now() + OTP_TTL_MS,
    });
  },
});

export const recordFailedAttempt = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const session = await ctx.db
      .query("otp_sessions")
      .withIndex("byPhone", (q) => q.eq("phone", phone))
      .order("desc")
      .first();

    if (!session) return;

    await ctx.db.patch(session._id, {
      attempts: session.attempts + 1,
    });
  },
});

/** Dev-only fallback when Twilio is not configured */
export const sendOtpDev = mutation({
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

    console.log(`[DEV OTP] ${normalized}: ${code}`);
    return { success: true, devCode: code };
  },
});

export const verifyOtpDev = mutation({
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
