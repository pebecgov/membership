export function firstThreeLetters(value: string): string {
  const letters = value.replace(/[^a-zA-Z]/g, "");
  if (!letters) return "XXX";
  return letters.slice(0, 3).toUpperCase().padEnd(3, "X");
}

/** e.g. NAC-LAG-1234567 — association (3) + state (3) + last 7 NIN digits */
export function buildMemberId(params: {
  associationName: string;
  state: string;
  nin: string;
}): string {
  const nin = params.nin.replace(/\s/g, "");
  if (nin.length < 7) {
    throw new Error("NIN must be at least 7 digits to generate a member ID.");
  }

  const assocPart = firstThreeLetters(params.associationName);
  const statePart = firstThreeLetters(params.state);
  const ninPart = nin.slice(-7);

  return `${assocPart}-${statePart}-${ninPart}`;
}
