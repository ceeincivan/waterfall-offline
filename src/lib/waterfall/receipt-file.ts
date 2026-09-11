import { humanLane, type Decision } from "./decision";
import { formatMoney, todayIso } from "./money";
import type { AllocationPlan } from "./types";

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function linesFor(plan: AllocationPlan, source: string, explanations: string[], dateIso: string): string[] {
  const lanes = new Map<string, number>();
  for (const l of plan.itemLines) {
    const lane = humanLane(l.bucket, l.kind);
    lanes.set(lane, (lanes.get(lane) ?? 0) + l.amountMinor);
  }
  if (plan.bankLine) lanes.set("Reserve", (lanes.get("Reserve") ?? 0) + plan.bankLine.amountMinor);

  return [
    "WATERFALL",
    "Allocation receipt",
    "",
    `${source}  ·  ${dateIso}`,
    `Income  ${formatMoney(plan.incomeMinor)}`,
    "",
    "How the money moved",
    ...[...lanes.entries()].map(([k, v]) => `  ${k.padEnd(12)}  ${formatMoney(v)}`),
    "",
    "Line by line",
    ...plan.itemLines.map((l) => `  ${l.label}  ${formatMoney(l.amountMinor)}${l.note ? `  — ${l.note}` : ""}`),
    plan.bankLine ? `  ${plan.bankLine.label}  ${formatMoney(plan.bankLine.amountMinor)}` : "",
    "",
    "Why",
    ...explanations.map((e) => `  ${e}`),
    "",
    "Money allocated. Ledger updated.",
  ].filter((x) => x !== undefined);
}

export function receiptText(plan: AllocationPlan, source: string, explanations: string[], dateIso = todayIso()): string {
  return linesFor(plan, source, explanations, dateIso).join("\n");
}

export function receiptPdfBytes(plan: AllocationPlan, source: string, explanations: string[], dateIso = todayIso()): Uint8Array {
  const lines = linesFor(plan, source, explanations, dateIso);
  const commands = lines
    .map((line, i) => {
      const y = 900 - i * 15;
      return `BT /F1 11 Tf 28 ${y} Td (${pdfEscape(line)}) Tj ET`;
    })
    .join("\n");
  const stream = commands + "\n";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 280 940] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj",
  ];
  let offset = 9;
  const offsets = [0];
  let body = "%PDF-1.4\n";
  for (const obj of objects) {
    offsets.push(offset);
    body += obj + "\n";
    offset += obj.length + 1;
  }
  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdf = body + xref + trailer;
  return new TextEncoder().encode(pdf);
}

export function downloadReceipt(plan: AllocationPlan, source: string, explanations: string[]) {
  const iso = todayIso();
  const bytes = receiptPdfBytes(plan, source, explanations, iso);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Waterfall-receipt-${iso}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function decisionToReceipt(decision: Decision, source: string) {
  return { plan: decision.plan, source, explanations: decision.explanations };
}
