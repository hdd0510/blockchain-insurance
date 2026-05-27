import StatusBadge from "../ui/StatusBadge";
import { CLAIM_STATUS_KEYS, claimStatusLabel } from "../../utils/format";

// Renders a colored badge for both numeric (on-chain) and string (off-chain) claim statuses.
export default function ClaimStatusBadge({ status }) {
  const isNumeric =
    typeof status === "number" ||
    (typeof status === "string" && status !== "" && !isNaN(status));
  const key = isNumeric ? CLAIM_STATUS_KEYS[Number(status)] || "pending" : status;
  const label = claimStatusLabel(isNumeric ? Number(status) : status);
  return <StatusBadge status={key} label={label} />;
}
