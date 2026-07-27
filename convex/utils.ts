/** Nigerian state → 3-letter code for member IDs */
export { NIGERIAN_STATES } from "../lib/nigerianStates";
export { buildMemberId, firstThreeLetters, getStateCode } from "../lib/memberId";

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
