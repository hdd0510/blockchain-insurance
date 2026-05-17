import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getSignedContracts } from "../services/contract-service";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { ethToWei } from "../utils/format";

// Submission steps for UI feedback
const STEPS = [
  { id: "upload", label: "Tải lên tài liệu" },
  { id: "tx", label: "Xác nhận giao dịch MetaMask" },
  { id: "confirm", label: "Chờ xác nhận blockchain" },
  { id: "save", label: "Lưu vào hệ thống" },
];

export default function NewClaimPage() {
  const { provider } = useAuth();
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  const [form, setForm] = useState({
    policy_id: "",
    amount_eth: "",
    description: "",
  });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null); // null = not started

  // Fetch customer's active policies for dropdown
  useEffect(() => {
    api
      .get("/policies")
      .then((res) => {
        const list = res.data?.policies || res.data || [];
        setPolicies(list.filter((p) => p.status === "active"));
      })
      .catch(console.error)
      .finally(() => setLoadingPolicies(false));
  }, []);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    setFiles(Array.from(e.target.files));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.policy_id) return toast.error("Vui lòng chọn hợp đồng.");
    if (!form.amount_eth || parseFloat(form.amount_eth) <= 0)
      return toast.error("Số tiền yêu cầu không hợp lệ.");
    if (!provider) return toast.error("Vui lòng kết nối MetaMask.");

    setSubmitting(true);
    setCurrentStep("upload");

    try {
      // Step 1: Upload evidence files
      let evidenceHash = ethers.ZeroHash;
      let uploadedFiles = [];

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        const uploadRes = await api.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploadedFiles = uploadRes.data?.files || [];
        // Use hash of first file CID or server-provided hash
        const hashStr = uploadRes.data?.evidence_hash || uploadedFiles[0]?.hash || "";
        if (hashStr) {
          evidenceHash = hashStr.startsWith("0x")
            ? hashStr.padEnd(66, "0")
            : ethers.id(hashStr);
        }
      }

      // Step 2: Submit claim on-chain via MetaMask
      setCurrentStep("tx");
      const { claimsContract } = await getSignedContracts(provider);
      const amountWei = ethToWei(form.amount_eth);
      const tx = await claimsContract.submitClaim(
        Number(form.policy_id),
        amountWei,
        evidenceHash
      );

      // Step 3: Wait for tx confirmation
      setCurrentStep("confirm");
      const receipt = await tx.wait();

      // Parse ClaimSubmitted event to get chain_claim_id
      let chainClaimId = null;
      if (receipt?.logs) {
        try {
          const iface = claimsContract.interface;
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed?.name === "ClaimSubmitted") {
                chainClaimId = parsed.args.claimId?.toString();
                break;
              }
            } catch {
              // skip unparseable logs
            }
          }
        } catch {
          // ignore parsing errors
        }
      }

      // Step 4: Save to backend
      setCurrentStep("save");
      const payload = {
        policy_id: Number(form.policy_id),
        amount_eth: form.amount_eth,
        description: form.description,
        chain_claim_id: chainClaimId,
        tx_hash: receipt.hash,
        evidence_hash: evidenceHash,
        file_ids: uploadedFiles.map((f) => f.id).filter(Boolean),
      };
      const saveRes = await api.post("/claims", payload);
      const savedClaim = saveRes.data?.claim || saveRes.data;

      toast.success("Yêu cầu bồi thường đã được gửi thành công!");
      navigate(`/claims/${savedClaim.id}`);
    } catch (err) {
      console.error("Submit claim error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        toast.error("Bạn đã từ chối giao dịch trong MetaMask.");
      } else {
        toast.error(err?.response?.data?.error || err.message || "Gửi yêu cầu thất bại.");
      }
    } finally {
      setSubmitting(false);
      setCurrentStep(null);
    }
  }

  if (loadingPolicies) return <LoadingSpinner text="Đang tải hợp đồng..." />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tạo yêu cầu bồi thường</h1>

      {/* Submission progress */}
      {submitting && currentStep && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-indigo-700 mb-3">Đang xử lý...</p>
          <div className="space-y-2">
            {STEPS.map((step) => {
              const stepIdx = STEPS.findIndex((s) => s.id === currentStep);
              const thisIdx = STEPS.findIndex((s) => s.id === step.id);
              const isDone = thisIdx < stepIdx;
              const isActive = step.id === currentStep;
              return (
                <div key={step.id} className="flex items-center gap-2 text-sm">
                  {isDone ? (
                    <span className="text-green-500">✓</span>
                  ) : isActive ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                  <span className={isActive ? "text-indigo-700 font-medium" : isDone ? "text-green-600" : "text-gray-400"}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Policy select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hợp đồng bảo hiểm <span className="text-red-500">*</span>
          </label>
          {policies.length === 0 ? (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              Không có hợp đồng còn hiệu lực. Vui lòng liên hệ admin.
            </p>
          ) : (
            <select
              name="policy_id"
              value={form.policy_id}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">-- Chọn hợp đồng --</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} — {p.policy_type} ({p.max_coverage_eth} ETH)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Số tiền yêu cầu (ETH) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="amount_eth"
            value={form.amount_eth}
            onChange={handleChange}
            required
            min="0.0001"
            step="0.0001"
            placeholder="0.5"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mô tả sự cố
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Mô tả chi tiết về sự cố xảy ra..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tài liệu bằng chứng
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {files.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {files.length} file đã chọn: {files.map((f) => f.name).join(", ")}
            </p>
          )}
        </div>

        {/* MetaMask notice */}
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-700">
          MetaMask sẽ yêu cầu bạn xác nhận giao dịch blockchain sau khi nhấn Gửi.
        </div>

        <button
          type="submit"
          disabled={submitting || policies.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? "Đang xử lý..." : "Gửi yêu cầu bồi thường"}
        </button>
      </form>
    </div>
  );
}
