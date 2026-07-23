/** Nigerian state → 3-letter code for member IDs */
import { STATE_CODES } from "../lib/nigerianStates";

export { NIGERIAN_STATES } from "../lib/nigerianStates";
export { buildMemberId, firstThreeLetters } from "../lib/memberId";

export function getStateCode(state: string): string {
  return STATE_CODES[state] ?? state.slice(0, 3).toUpperCase();
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function isValidNigerianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+234\d{10}$/.test(normalized);
}

export function isValidNin(nin: string): boolean {
  return /^\d{11}$/.test(nin.replace(/\s/g, ""));
}
