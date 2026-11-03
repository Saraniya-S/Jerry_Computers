import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/server/permissions";
import { serviceDeskRows } from "@/lib/server/admin/service-desk-report";
import { getSessionUser } from "@/lib/server/session";
import { deviceTypeLabel, priorityLabel, serviceNumber, serviceStatusLabel } from "@/lib/service-desk";

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const when = (d: Date | null) => (d ? stamp.format(d).replace(",", "") : "");
/** Quotes a CSV cell, and stops spreadsheet apps reading text as a formula. */
const cell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Every service job created in the period as a CSV, for admins with report access. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.role, "reports.view")) return new NextResponse("Not found", { status: 404 });
  const sp = request.nextUrl.searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  let from = day(sp.get("from")) ?? today;
  let to = day(sp.get("to")) ?? today;
  if (from > to) [from, to] = [to, from];

  const rows = await serviceDeskRows({ from, to });
  const header = ["Ticket", "Received", "Status", "Priority", "Device type", "Device", "Where", "Channel", "Problem chosen", "Customer", "Phone", "Lead engineer", "Helpers", "Accepted", "Completed", "Hours to complete", "Collected (Rs.)"];
  const lines = rows.map((r) =>
    [
      serviceNumber(r.seq),
      when(r.createdAt),
      serviceStatusLabel[r.status],
      priorityLabel[r.priority],
      deviceTypeLabel[r.deviceType],
      r.device,
      r.location === "on_site" ? "On-site" : "In shop",
      r.source === "walk_in" ? "Walk-in" : r.source === "phone" ? "Phone" : "Online",
      r.problemType ?? "",
      r.contactName,
      r.contactPhone,
      r.engineer?.trim() ?? "",
      r.helpers,
      when(r.acceptedAt),
      when(r.completedAt),
      r.completedAt ? ((r.completedAt.getTime() - r.createdAt.getTime()) / 3_600_000).toFixed(1) : "",
      (r.collectedPaise / 100).toFixed(2),
    ]
      .map(cell)
      .join(","),
  );
  // A byte-order mark so Excel opens the file as UTF-8.
  return new NextResponse(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="service-desk-${from}-to-${to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
