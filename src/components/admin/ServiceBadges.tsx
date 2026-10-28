import { Badge, type Tone } from "@/components/admin/ui";
import { priorityLabel, serviceStatusLabel } from "@/lib/service-desk";
import type { ServicePriority, ServiceStatus } from "@/lib/server/db/schema";

const statusTone: Record<ServiceStatus, Tone> = {
  open: "warn",
  assigned: "brand",
  accepted: "brand",
  in_progress: "info",
  awaiting_parts: "warn",
  awaiting_customer: "warn",
  unable_to_complete: "bad",
  completed: "good",
  cancelled: "muted",
};
const priorityTone: Record<ServicePriority, Tone> = { low: "muted", normal: "neutral", high: "warn", urgent: "bad" };

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return <Badge tone={statusTone[status]}>{serviceStatusLabel[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: ServicePriority }) {
  return <Badge tone={priorityTone[priority]}>{priorityLabel[priority]}</Badge>;
}
