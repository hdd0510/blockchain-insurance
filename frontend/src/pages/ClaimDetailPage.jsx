import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";
import StatusBadge from "../components/ui/StatusBadge";
import TxHash from "../components/ui/TxHash";
import {
  getClaim,
  getClaimChainState,
  signApproval,
  syncClaim,
  escalateClaim,
} from "../services/claim-service";
import { fileAppeal as apiFileAppeal, reviewAppeal } from "../services/appeal-service";
import {
  getSignedContracts,
  reviewAppealWithWallet,
  signClaimApprovalWithWallet,
} from "../services/contract-service";
import { hospitalVerificationLabel, appealStatusLabel } from "../utils/format";

export default function ClaimDetailPage() {
  const { id } = useParams();
  const { provider, isAdmin, isInsurer, isCustomer } = useAuth();
  const [claim, setClaim] = useState(null);
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);
  const [appealing, setAppealing] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [showAppealForm, setShowAppealForm] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ch] = await Promise.all([
        getClaim(id),
        getClaimChainState(id).catch(() => null),
      ]);
      setClaim(c);
      setChain(ch);
    } catch (err) {
      setError(err?.response?.data?.error || "Không thể tải yêu cầu.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSign = async () => {
    setSigning(true);
    try {
      if (!provider) throw new Error("Kết nối MetaMask trước");
      const receipt = await signClaimApprovalWithWallet(provider, claim.chain_claim_id);
      await signApproval(id, false, receipt.hash);
      toast.success("Đã ký phê duyệt bằng MetaMask");
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleSyncFromChain = async () => {
    try {
      await syncClaim(id);
      toast.success("Đã đồng bộ trạng thái từ blockchain");
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
  };

  const handleEscalate = async () => {
    if (!window.confirm("Xác nhận escalate? Yêu cầu sẽ bị đánh dấu Expired.")) return;
    try {
      await escalateClaim(id);
      toast.success("Đã escalate yêu cầu");
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
  };

  const handleFileAppeal = async () => {
    if (!appealReason.trim()) return toast.error("Nhập lý do kháng cáo trước.");
    if (!provider) return toast.error("Kết nối MetaMask trước.");
    if (!claim.chain_claim_id) return toast.error("Hồ sơ chưa lên on-chain.");

    setAppealing(true);
    try {
      const { claimsContract } = await getSignedContracts(provider);
      const tx = await claimsContract.fileAppeal(
        Number(claim.chain_claim_id),
        appealReason
      );
      const receipt = await tx.wait();
      await apiFileAppeal({
        claim_id: claim.id,
        reason: appealReason,
        tx_hash: receipt.hash,
      });
      toast.success("Đã nộp đơn kháng cáo");
      setShowAppealForm(false);
      setAppealReason("");
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setAppealing(false);
    }
  };

  const handleReviewAppeal = async (accept) => {
    try {
      if (!provider) throw new Error("Kết nối MetaMask trước");
      const receipt = await reviewAppealWithWallet(provider, claim.chain_claim_id, accept);
      await reviewAppeal(claim.id, {
        accept,
        tx_hash: receipt.hash,
      });
      toast.success(`Đã ${accept ? "chấp nhận" : "bác bỏ"} kháng cáo`);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
  };

  if (loading) return <LoadingSpinner text="Đang tải..." />;
  if (error)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      </div>
    );
  if (!claim) return null;

  const files = claim.files || [];
  const appeal = claim.appeal;
  const verifications = claim.verifications || [];

  const approvals = chain?.claim?.approvalsCount ?? claim.approvals_count;
  const thresholdReq = chain?.threshold ?? claim.threshold_required;
  const adminSigners = chain?.admin_signers || [];

  const canSign =
    (isAdmin || isInsurer) &&
    chain?.on_chain &&
    ["pending", "under_review", "needs_info"].includes(
      chain.claim?.statusLabel || claim.status
    );

  const canFileAppeal =
    isCustomer && claim.status === "rejected" && !appeal;

  const canReviewAppeal =
    (isAdmin || isInsurer) &&
    appeal &&
    !["accepted", "rejected"].includes(appeal.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/claims" className="hover:text-indigo-600">Yêu cầu</Link>
        <span>/</span>
        <span className="text-gray-600">#{id}</span>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Yêu cầu bồi thường #{claim.id}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Hợp đồng{" "}
              <Link
                to={`/policies/${claim.policy_id}`}
                className="text-indigo-600 hover:underline"
              >
                #{claim.policy_id}
              </Link>
              {claim.chain_claim_id && (
                <> • on-chain id <span className="font-mono">{claim.chain_claim_id}</span></>
              )}
            </p>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Số tiền yêu cầu</p>
            <p className="font-bold text-indigo-600 text-lg">{claim.amount_eth} ETH</p>
          </div>
          <div>
            <p className="text-gray-400">Bệnh viện xác minh</p>
            <p className="font-mono text-xs break-all">
              {claim.hospital_wallet || "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Patient ID Hash</p>
            <p className="font-mono text-[10px] break-all">
              {claim.patient_id_hash || "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Ngày gửi</p>
            <p className="font-medium text-gray-700">
              {claim.submitted_at
                ? new Date(claim.submitted_at).toLocaleString("vi-VN")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Timeout</p>
            <p className="font-medium text-gray-700">
              {claim.timeout_at
                ? new Date(claim.timeout_at).toLocaleString("vi-VN")
                : "—"}
            </p>
          </div>
          {claim.tx_hash && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 mb-1">Last Tx</p>
              <TxHash hash={claim.tx_hash} />
            </div>
          )}
          {claim.reject_reason && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 mb-1">Lý do từ chối</p>
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                {claim.reject_reason}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            onClick={handleSyncFromChain}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
          >
            Đồng bộ on-chain
          </button>
          {(isAdmin || isInsurer) && (
            <button
              onClick={handleEscalate}
              className="text-xs px-3 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-700"
            >
              Escalate timeout
            </button>
          )}
        </div>
      </div>

      {/* Multi-sig progress (Section 2.3) */}
      {chain?.on_chain && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Multi-sig phê duyệt
          </h2>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-gray-500">Tiến độ:</span>
            <span className="font-semibold text-indigo-700">
              {approvals}/{thresholdReq}
            </span>
            <span className="text-gray-400">chữ ký</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="bg-indigo-500 h-2"
              style={{
                width: `${Math.min(100, (approvals / (thresholdReq || 1)) * 100)}%`,
              }}
            />
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Tất cả admin signers: {adminSigners.length}
          </div>

          {canSign && (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={signing}
                onClick={() => handleSign()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg"
              >
                {signing ? "..." : "Ký bằng MetaMask"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Oracle status (Section 2.2) */}
      {chain?.on_chain && Number(chain.claim?.oracleRequestId) > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Oracle xác minh
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400">Oracle Request ID</p>
              <p className="font-mono">{chain.claim.oracleRequestId}</p>
            </div>
            <div>
              <p className="text-gray-400">Kết quả</p>
              <p className="font-semibold">
                {chain.claim.oracleVerified === true ? (
                  <span className="text-emerald-600">VERIFIED ✓</span>
                ) : chain.claim.oracleVerified === false ? (
                  <span className="text-red-600">NOT VERIFIED ✗</span>
                ) : (
                  <span className="text-gray-500">Đang chờ Oracle...</span>
                )}
              </p>
            </div>
            {chain.claim.oracleNote && (
              <div className="col-span-2">
                <p className="text-gray-400">Ghi chú Oracle</p>
                <p>{chain.claim.oracleNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hospital verifications history */}
      {verifications.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Lịch sử xác minh bệnh viện ({verifications.length})
          </h2>
          <div className="space-y-3">
            {verifications.map((v) => (
              <div
                key={v.id}
                className="border border-gray-100 rounded-lg p-3 text-sm flex items-start gap-3"
              >
                <StatusBadge
                  status={v.result}
                  label={hospitalVerificationLabel(v.result)}
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-400">
                    Request #{v.oracle_request_id} •{" "}
                    {new Date(v.requested_at).toLocaleString("vi-VN")}
                  </p>
                  {v.note && <p className="text-gray-700 mt-1">{v.note}</p>}
                  {v.oracle_tx_hash && (
                    <div className="mt-2">
                      <TxHash hash={v.oracle_tx_hash} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appeal (Section 2.4) */}
      {appeal && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-purple-800">Kháng cáo</h2>
            <StatusBadge
              status={appeal.status}
              label={appealStatusLabel(appeal.status)}
            />
          </div>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Lý do:</strong> {appeal.reason}
          </p>
          {appeal.resolution_note && (
            <p className="text-sm text-gray-600 italic mb-2">
              Ghi chú giải quyết: {appeal.resolution_note}
            </p>
          )}
          {Array.isArray(appeal.reviewed_by_wallets) &&
            appeal.reviewed_by_wallets.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                {appeal.reviewed_by_wallets.map((r, i) => (
                  <div key={i} className="text-gray-500">
                    <span className="font-mono">{r.wallet}</span> →{" "}
                    {r.accept ? "✓ accept" : "✗ reject"}
                  </div>
                ))}
              </div>
            )}
          {canReviewAppeal && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={() => handleReviewAppeal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
              >
                Chấp nhận
              </button>
              <button
                onClick={() => handleReviewAppeal(false)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
              >
                Bác bỏ
              </button>
            </div>
          )}
        </div>
      )}

      {canFileAppeal && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6 mb-6">
          {!showAppealForm ? (
            <button
              onClick={() => setShowAppealForm(true)}
              className="w-full text-left text-yellow-800 font-medium hover:underline"
            >
              Yêu cầu của bạn bị từ chối. Nộp đơn kháng cáo →
            </button>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                Nộp đơn kháng cáo
              </h3>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={3}
                placeholder="Cung cấp thêm bằng chứng / lý do để xem xét lại..."
                className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-2"
              />
              <div className="flex gap-2">
                <button
                  disabled={appealing}
                  onClick={handleFileAppeal}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-sm rounded-lg"
                >
                  {appealing ? "Đang gửi..." : "Gửi kháng cáo"}
                </button>
                <button
                  onClick={() => setShowAppealForm(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg"
                >
                  Huỷ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Evidence files */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Tài liệu đính kèm ({files.length}) — pin IPFS
          </h2>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{file.file_name}</p>
                  {file.ipfs_cid && (
                    <p className="text-[10px] font-mono text-gray-500 truncate">
                      CID: {file.ipfs_cid}
                    </p>
                  )}
                  {file.content_hash && (
                    <p className="text-[10px] font-mono text-gray-400 truncate">
                      sha256: {file.content_hash}
                    </p>
                  )}
                </div>
                <a
                  href={`/api/files/${file.id}`}
                  className="text-xs text-indigo-600 hover:underline shrink-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tải xuống
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
