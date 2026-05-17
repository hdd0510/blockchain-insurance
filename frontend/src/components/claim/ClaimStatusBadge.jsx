import StatusBadge from "../ui/StatusBadge";
import { claimStatusLabel } from "../../utils/format";

// Claim-specific status badge mapping numeric or string status to Vietnamese label
export default function ClaimStatusBadge({ status }) {
  // Handle both numeric (from chain) and string (from API) status
  const isNumeric = typeof status === "number" || (typeof status === "string" && !isNaN(status));
  const label = isNumeric ? claimStatusLabel(Number(status)) : claimStatusLabel(status);

  // Map numeric index to string key for color
  const NUMERIC_TO_KEY = ["pending", "under_review", "needs_info", "approved", "rejected", "paid"];
  const colorKey = isNumeric ? (NUMERIC_TO_KEY[Number(status)] || "pending") : status;

  return <StatusBadge status={colorKey} label={label} />;
}
