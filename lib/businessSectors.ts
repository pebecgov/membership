/** Generic business sectors for private-sector engagement. */

export const BUSINESS_SECTORS = [
  "Agriculture",
  "Manufacturing",
  "Trade and commerce",
  "Construction",
  "Energy and power",
  "Oil and gas",
  "Financial services",
  "Information and communication technology",
  "Telecommunications",
  "Transportation and logistics",
  "Health",
  "Education",
  "Hospitality and tourism",
  "Professional services",
  "Mining and solid minerals",
  "Real estate",
  "Media and creative industries",
  "Other",
] as const;

export type BusinessSector = (typeof BUSINESS_SECTORS)[number];
