/** Nigerian state → 3-letter code for member IDs */
import { STATE_CODES } from "../lib/nigerianStates";

export { NIGERIAN_STATES } from "../lib/nigerianStates";

export function getStateCode(state: string): string {
  return STATE_CODES[state] ?? state.slice(0, 3).toUpperCase();
}

/** e.g. NACCIMA-LAG-JD-0001 */
export function buildMemberId(params: {
  associationCode: string;
  state: string;
  fullName: string;
  sequence: number;
}): string {
  const stateCode = getStateCode(params.state);
  const parts = params.fullName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "XX").toUpperCase();
  const seq = String(params.sequence).padStart(4, "0");
  return `${params.associationCode.toUpperCase()}-${stateCode}-${initials}-${seq}`;
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
