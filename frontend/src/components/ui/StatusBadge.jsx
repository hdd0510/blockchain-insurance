// Colored badge for claim or policy status
const COLOR_MAP = {
  // Claim statuses (string keys)
  pending:       "bg-yellow-100 text-yellow-800",
  under_review:  "bg-blue-100 text-blue-800",
  needs_info:    "bg-orange-100 text-orange-800",
  approved:      "bg-green-100 text-green-800",
  rejected:      "bg-red-100 text-red-800",
  paid:          "bg-emerald-100 text-emerald-800",
  // Policy statuses
  active:        "bg-green-100 text-green-800",
  expired:       "bg-gray-100 text-gray-600",
  cancelled:     "bg-red-100 text-red-800",
};

export default function StatusBadge({ status, label }) {
  const colorClass = COLOR_MAP[status] || "bg-gray-100 text-gray-700";
  const displayLabel = label || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {displayLabel}
    </span>
  );
}
