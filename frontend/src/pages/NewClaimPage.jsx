import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getSignedContracts, hashPatientId } from "../services/contract-service";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { ethToWei } from "../utils/format";

// v2 flow: customer also picks a hospital + supplies a patient id so the
// oracle can verify the medical record once admin signers approve.
const STEPS = [
  { id: "upload", label: "Tải lên IPFS" },
  { id: "tx", label: "Xác nhận giao dịch MetaMask" },
  { id: "confirm", label: "Chờ xác nhận blockchain" },
  { id: "save", label: "Lưu vào hệ thống" },
];

export default function NewClaimPage() {
  const { provider } = useAuth();
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  const [form, setForm] = useState({
    policy_id: "",
    amount_eth: "",
    description: "",
    patient_id: "",
    hospital_wallet: "",
  });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/policies").then((r) => r.data || []),
      api.get("/hospital/catalog").then((r) => r.data || []).catch(() => []),
    ])
      .then(([policyList, hospitalList]) => {
        setPolicies(
          (Array.isArray(policyList) ? policyList : policyList.policies || []).filter(
            (p) => p.status === "active"
          )
        );
        setHospitals(hospitalList);
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
    if (!form.patient_id)
      return toast.error("Vui lòng nhập mã bệnh nhân để oracle xác minh.");
    if (!form.hospital_wallet || !/^0x[0-9a-fA-F]{40}$/.test(form.hospital_wallet))
      return toast.error("Ví bệnh viện không hợp lệ.");
    if (!provider) return toast.error("Vui lòng kết nối MetaMask.");

    const selectedPolicy = policies.find(
      (p) => String(p.id) === String(form.policy_id)
    );
    if (!selectedPolicy?.chain_policy_id) {
      return toast.error("Hợp đồng chưa được ghi nhận trên blockchain. Liên hệ Admin.");
    }

    setSubmitting(true);
    setCurrentStep("upload");

    try {
      // We pin to IPFS via /files/upload only AFTER we have the claim id,
      // so use a hash of file metadata for the on-chain `evidenceHash`
      // when files are present. For zero-file demos use ZeroHash.
      let evidenceHash = ethers.ZeroHash;
      let pendingFiles = files;

      if (files.length > 0) {
        // Compute a deterministic preview hash from the first file's name+size
        // so the on-chain hash is non-zero even before pinning. Real pinning
        // happens after the claim row exists.
        const meta = files
          .map((f) => `${f.name}:${f.size}:${f.lastModified}`)
          .join("|");
        evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(meta));
      }

      const patientIdHash = hashPatientId(form.patient_id.trim());

      setCurrentStep("tx");
      const { claimsContract } = await getSignedContracts(provider);
      const amountWei = ethToWei(form.amount_eth);
      const tx = await claimsContract.submitClaim(
        Number(selectedPolicy.chain_policy_id),
        amountWei,
        evidenceHash,
        patientIdHash,
        form.hospital_wallet
      );

      setCurrentStep("confirm");
      const receipt = await tx.wait();

      let chainClaimId = null;
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = claimsContract.interface.parseLog(log);
            if (parsed?.name === "ClaimSubmitted") {
              chainClaimId = parsed.args.claimId?.toString();
              break;
            }
          } catch {
            /* skip */
          }
        }
      }

      setCurrentStep("save");
      const saveRes = await api.post("/claims", {
        policy_id: Number(form.policy_id),
        amount_eth: form.amount_eth,
        description: form.description,
        chain_claim_id: chainClaimId,
        tx_hash: receipt.hash,
        evidence_hash: evidenceHash,
        patient_id_hash: patientIdHash,
        hospital_wallet: form.hospital_wallet.toLowerCase(),
      });
      const savedClaim = saveRes.data?.claim || saveRes.data;

      // Pin uploaded files to IPFS now that we have the claim id.
      if (pendingFiles.length > 0) {
        const formData = new FormData();
        formData.append("claim_id", String(savedClaim.id));
        pendingFiles.forEach((file) => formData.append("files", file));
        await api.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

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
                  #{p.chain_policy_id} — {p.policy_type} ({p.max_coverage_eth} ETH)
                </option>
              ))}
            </select>
          )}
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã bệnh nhân (Patient ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="patient_id"
              value={form.patient_id}
              onChange={handleChange}
              required
              placeholder="VD: BN-2024-0001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Mã sẽ được hash keccak256 trước khi đưa lên blockchain — bệnh viện nhận hash này để tra cứu trong DB nội bộ.
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Demo: <code>PATIENT-001</code> có hồ sơ hợp lệ, <code>PATIENT-002</code> có hồ sơ nhưng bị đánh dấu không claimable.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ví bệnh viện xác minh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="hospital_wallet"
              value={form.hospital_wallet}
              onChange={handleChange}
              required
              placeholder="0x..."
              list="hospital-list"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <datalist id="hospital-list">
              {hospitals.map((h) => (
                <option key={h.wallet} value={h.wallet}>
                  {h.name}
                </option>
              ))}
            </datalist>
            {hospitals.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-1">
                Demo hospital: {hospitals[0].name} ({hospitals[0].wallet})
              </p>
            )}
          </div>
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tài liệu bằng chứng (sẽ pin lên IPFS)
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

        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-700">
          MetaMask sẽ yêu cầu xác nhận giao dịch. Sau khi gửi, hồ sơ sẽ:
          <ol className="list-decimal ml-5 mt-1 space-y-0.5 text-xs">
            <li>Chờ N/M admin signer ký multi-sig</li>
            <li>Smart contract tự gọi Oracle để xác minh với bệnh viện</li>
            <li>Nếu khớp → tự động chuyển ETH; nếu không → tự động từ chối</li>
          </ol>
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
