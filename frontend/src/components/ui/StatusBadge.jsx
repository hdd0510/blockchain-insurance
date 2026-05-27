// Colored badge for claim, policy, appeal or verification status.
const COLOR_MAP = {
  // Claim statuses
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  oracle_verified: "bg-cyan-100 text-cyan-800",
  needs_info: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
  appealed: "bg-purple-100 text-purple-800",
  appeal_reviewing: "bg-fuchsia-100 text-fuchsia-800",
  appeal_accepted: "bg-emerald-100 text-emerald-800",
  appeal_rejected: "bg-red-200 text-red-900",
  expired: "bg-gray-200 text-gray-700",
  // Policy statuses
  active: "bg-green-100 text-green-800",
  expired_policy: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-800",
  // Appeal statuses
  filed: "bg-purple-100 text-purple-800",
  reviewing: "bg-fuchsia-100 text-fuchsia-800",
  accepted: "bg-emerald-100 text-emerald-800",
  // Hospital verification
  verified: "bg-emerald-100 text-emerald-800",
  not_verified: "bg-red-100 text-red-800",
  error: "bg-rose-100 text-rose-800",
};

export default function StatusBadge({ status, label }) {
  const colorClass = COLOR_MAP[status] || "bg-gray-100 text-gray-700";
  const displayLabel = label || status;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
}
