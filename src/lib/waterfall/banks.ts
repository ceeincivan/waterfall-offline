export type InstitutionKind = "bank" | "mpesa" | "cash" | "other";

export interface Institution {
  name: string;
  kind: InstitutionKind;
}

export const INSTITUTIONS: Institution[] = [
  { name: "M-PESA", kind: "mpesa" },
  { name: "Equity Bank", kind: "bank" },
  { name: "KCB", kind: "bank" },
  { name: "Co-operative Bank", kind: "bank" },
  { name: "NCBA", kind: "bank" },
  { name: "Absa", kind: "bank" },
  { name: "Stanbic", kind: "bank" },
  { name: "I&M", kind: "bank" },
  { name: "DTB", kind: "bank" },
  { name: "Family Bank", kind: "bank" },
  { name: "Standard Chartered", kind: "bank" },
  { name: "Access Bank", kind: "bank" },
  { name: "Bank of Africa", kind: "bank" },
  { name: "Sidian Bank", kind: "bank" },
  { name: "Prime Bank", kind: "bank" },
  { name: "Cash", kind: "cash" },
  { name: "Other", kind: "other" },
];

export function searchInstitutions(query: string): Institution[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSTITUTIONS;
  return INSTITUTIONS.filter((i) => i.name.toLowerCase().includes(q));
}

export function purposeForKind(kind: InstitutionKind): "SPENDING" | "BILLS" | "SAVINGS" | "MPESA" | "CASH" {
  if (kind === "mpesa") return "MPESA";
  if (kind === "cash") return "CASH";
  return "SPENDING";
}
