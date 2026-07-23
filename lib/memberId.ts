export function firstThreeLetters(value: string): string {
  const letters = value.replace(/[^a-zA-Z]/g, "");
  if (!letters) return "XXX";
  return letters.slice(0, 3).toUpperCase().padEnd(3, "X");
}

/** e.g. NAC-LAG-123456 — association (3) + state (3) + last 6 NIN digits */
export function buildMemberId(params: {
  associationName: string;
  state: string;
  nin: string;
}): string {
  const nin = params.nin.replace(/\s/g, "");
  if (nin.length < 6) {
    throw new Error("NIN must be at least 6 digits to generate a member ID.");
  }

  const assocPart = firstThreeLetters(params.associationName);
  const statePart = firstThreeLetters(params.state);
  const ninPart = nin.slice(-6);

  return `${assocPart}-${statePart}-${ninPart}`;
}
