import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";
import TxHash from "../components/ui/TxHash";
import { claimStatusLabel } from "../utils/format";

export default function ClaimDetailPage() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/claims/${id}`)
      .then((res) => setClaim(res.data?.claim || res.data))
      .catch((err) => setError(err?.response?.data?.error || "Không thể tải yêu cầu."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner text="Đang tải..." />;
  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>
    </div>
  );
  if (!claim) return null;

  const files = claim.evidence_files || claim.files || [];
  const history = claim.status_history || [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/claims" className="hover:text-indigo-600">Yêu cầu</Link>
        <span>/</span>
        <span className="text-gray-600">#{id}</span>
      </div>

      {/* Main details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Yêu cầu bồi thường #{claim.id}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Hợp đồng{" "}
              <Link to={`/policies/${claim.policy_id}`} className="text-indigo-600 hover:underline">
                #{claim.policy_id}
              </Link>
            </p>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-400">Số tiền yêu cầu</p>
            <p className="font-bold text-indigo-600 text-lg">{claim.amount_eth} ETH</p>
          </div>
          <div>
            <p className="text-gray-400">Ngày tạo</p>
            <p className="font-medium text-gray-700">
              {claim.created_at ? new Date(claim.created_at).toLocaleDateString("vi-VN") : "—"}
            </p>
          </div>
          {claim.tx_hash && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">Transaction Hash</p>
              <TxHash hash={claim.tx_hash} />
            </div>
          )}
          {claim.evidence_hash && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">Evidence Hash</p>
              <p className="font-mono text-xs text-gray-600 break-all">{claim.evidence_hash}</p>
            </div>
          )}
          {claim.reject_reason && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">Lý do từ chối</p>
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{claim.reject_reason}</p>
            </div>
          )}
        </div>

        {claim.description && (
          <div className="border-t border-gray-50 pt-4">
            <p className="text-gray-400 text-sm mb-1">Mô tả</p>
            <p className="text-gray-700 text-sm">{claim.description}</p>
          </div>
        )}
      </div>

      {/* Evidence files */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Tài liệu đính kèm ({files.length})
          </h2>
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700 truncate">
                  {file.original_name || file.filename || `File ${idx + 1}`}
                </span>
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline ml-3 shrink-0"
                  >
                    Tải xuống
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status history */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Lịch sử trạng thái</h2>
          <div className="space-y-3">
            {history.map((h, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {typeof h.status === "number" ? claimStatusLabel(h.status) : h.status}
                  </p>
                  {h.note && <p className="text-xs text-gray-400">{h.note}</p>}
                  {h.created_at && (
                    <p className="text-xs text-gray-400">
                      {new Date(h.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
