import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../../components/claim/ClaimStatusBadge";
import TxHash from "../../components/ui/TxHash";
import { signApproval, rejectClaim } from "../../services/claim-service";
import { CLAIM_STATUS_LABELS } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import { signClaimApprovalWithWallet } from "../../services/contract-service";

function RejectModal({ claimId, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-base font-semibold text-gray-800 mb-3">
          Từ chối thủ công yêu cầu #{claimId}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Lưu ý: từ chối thủ công bỏ qua Oracle. Multi-sig approve yêu cầu từng
          admin signer tự ký bằng MetaMask.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Nhập lý do từ chối..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm"
          >
            {loading ? "Đang xử lý..." : "Xác nhận từ chối"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminClaimsPage({ mode = "admin" }) {
  const { isInsurer, provider } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchClaims = useCallback(() => {
    setLoading(true);
    api
      .get("/claims")
      .then((res) => setClaims(res.data?.claims || res.data || []))
      .catch((err) =>
        toast.error(err?.response?.data?.error || "Không thể tải yêu cầu.")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  async function handleSign(claimId, chainClaimId) {
    setProcessingId(claimId);
    try {
      if (!provider) throw new Error("Kết nối MetaMask trước");
      const receipt = await signClaimApprovalWithWallet(provider, chainClaimId);
      await signApproval(claimId, false, receipt.hash);
      toast.success(`Đã ký multi-sig yêu cầu #${claimId} bằng ví hiện tại`);
      fetchClaims();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Ký thất bại.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectConfirm(reason) {
    if (!rejectModalId) return;
    setProcessingId(rejectModalId);
    try {
      await rejectClaim(rejectModalId, reason);
      toast.success(`Yêu cầu #${rejectModalId} đã bị từ chối.`);
      setRejectModalId(null);
      fetchClaims();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Từ chối thất bại.");
    } finally {
      setProcessingId(null);
    }
  }

  const filteredClaims =
    statusFilter === "all"
      ? claims
      : claims.filter((c) => c.status === statusFilter);

  const canSign = (status) =>
    ["pending", "under_review", "needs_info"].includes(status);

  if (loading) return <LoadingSpinner text="Đang tải yêu cầu..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {rejectModalId && (
        <RejectModal
          claimId={rejectModalId}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectModalId(null)}
          loading={processingId === rejectModalId}
        />
      )}

      <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {mode === "insurer" || isInsurer
              ? "Insurer Portal: xử lý yêu cầu bồi thường"
              : "Quản lý yêu cầu bồi thường (multi-sig + Oracle)"}
          </h1>
        <span className="text-sm text-gray-400">{claims.length} yêu cầu</span>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { value: "all", label: "Tất cả" },
          ...Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1 opacity-70">
                ({claims.filter((c) => c.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredClaims.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>Không có yêu cầu nào.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Hợp đồng</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Số tiền</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Multi-sig</th>
                <th className="px-4 py-3 text-left">Tx Hash</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link
                      to={`/claims/${claim.id}`}
                      className="hover:text-indigo-600"
                    >
                      #{claim.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {claim.policy_id ? (
                      <Link
                        to={`/policies/${claim.policy_id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        #{claim.policy_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {claim.claimant_wallet
                      ? `${claim.claimant_wallet.slice(0, 6)}...${claim.claimant_wallet.slice(-4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {claim.amount_eth} ETH
                  </td>
                  <td className="px-4 py-3">
                    <ClaimStatusBadge status={claim.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold">
                      {claim.approvals_count ?? 0}/
                      {claim.threshold_required ?? "?"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TxHash hash={claim.tx_hash} />
                  </td>
                  <td className="px-4 py-3">
                    {canSign(claim.status) ? (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => handleSign(claim.id, claim.chain_claim_id)}
                          disabled={processingId === claim.id}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-50"
                          title="Ký bằng ví MetaMask hiện tại"
                        >
                          {processingId === claim.id ? "..." : "Ký bằng ví"}
                        </button>
                        <button
                          onClick={() => setRejectModalId(claim.id)}
                          disabled={processingId === claim.id}
                          className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : (
                      <Link
                        to={`/claims/${claim.id}`}
                        className="text-xs text-gray-400 hover:text-indigo-600"
                      >
                        Xem
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
