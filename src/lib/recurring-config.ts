// Frontend recurring feature flags. Server flags are mirrored via Vite envs
// where it's safe to expose them to the client (UI behaviors only).
const v = (k: string, dflt: boolean) => {
  const raw = (import.meta.env as any)?.[k];
  if (raw === undefined || raw === "") return dflt;
  return String(raw).toLowerCase() === "true" || raw === true || raw === "1";
};

export const recurringFlags = {
  realtimeDonor: v("VITE_RECURRING_REALTIME_DONOR", false),
  realtimeAdminDetail: v("VITE_RECURRING_REALTIME_ADMIN_DETAIL", false),
  realtimeAdminOverview: v("VITE_RECURRING_REALTIME_ADMIN_OVERVIEW", false),
};

export type RecurringStatusColor = "healthy" | "degraded" | "critical" | "unknown";
