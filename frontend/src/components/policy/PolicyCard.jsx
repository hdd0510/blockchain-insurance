import { Link } from "react-router-dom";
import StatusBadge from "../ui/StatusBadge";
import { weiToEth, formatDate, policyStatusLabel } from "../../utils/format";

// Policy type Vietnamese labels
const POLICY_TYPE_LABEL = {
  health: "Bảo hiểm sức khỏe",
  car: "Bảo hiểm xe hơi",
  home: "Bảo hiểm nhà",
  life: "Bảo hiểm nhân thọ",
};

export default function PolicyCard({ policy }) {
  const {
    id,
    policy_type,
    max_coverage_eth,
    max_coverage,
    status,
    end_date,
    expiry_date,
  } = policy;

  // Support both API field names
  const coverageEth = max_coverage_eth || (max_coverage ? weiToEth(max_coverage) : "—");
  const expiry = end_date || expiry_date;
  const typeLabel = POLICY_TYPE_LABEL[policy_type] || policy_type;
  const statusLabel = policyStatusLabel(status);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Hợp đồng #{id}
          </p>
          <h3 className="text-base font-semibold text-gray-800 mt-0.5">{typeLabel}</h3>
        </div>
        <StatusBadge status={status} label={statusLabel} />
      </div>

      {/* Coverage */}
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <span className="font-medium text-indigo-600 text-lg">{coverageEth}</span>
        <span className="text-gray-400">ETH</span>
        <span className="text-gray-400 text-xs ml-1">bảo hiểm tối đa</span>
      </div>

      {/* Expiry */}
      {expiry && (
        <p className="text-xs text-gray-500">
          Hết hạn:{" "}
          <span className="font-medium text-gray-700">
            {typeof expiry === "string"
              ? new Date(expiry).toLocaleDateString("vi-VN")
              : formatDate(expiry)}
          </span>
        </p>
      )}

      {/* Action */}
      <Link
        to={`/policies/${id}`}
        className="mt-auto inline-block text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Xem chi tiết →
      </Link>
    </div>
  );
}
