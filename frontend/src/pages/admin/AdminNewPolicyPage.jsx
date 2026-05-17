import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";

const POLICY_TYPES = [
  { value: "health", label: "Bảo hiểm sức khỏe" },
  { value: "car", label: "Bảo hiểm xe hơi" },
  { value: "home", label: "Bảo hiểm nhà" },
  { value: "life", label: "Bảo hiểm nhân thọ" },
];

export default function AdminNewPolicyPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_wallet: "",
    policy_type: "health",
    premium_eth: "",
    max_coverage_eth: "",
    duration_days: "365",
  });

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.customer_wallet.startsWith("0x") || form.customer_wallet.length !== 42) {
      return toast.error("Địa chỉ ví không hợp lệ.");
    }
    if (parseFloat(form.premium_eth) <= 0 || parseFloat(form.max_coverage_eth) <= 0) {
      return toast.error("Phí và mức bảo hiểm phải lớn hơn 0.");
    }
    if (parseInt(form.duration_days) < 1) {
      return toast.error("Thời hạn phải ít nhất 1 ngày.");
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_wallet: form.customer_wallet.toLowerCase(),
        policy_type: form.policy_type,
        premium_eth: form.premium_eth,
        max_coverage_eth: form.max_coverage_eth,
        duration_days: parseInt(form.duration_days),
      };
      const res = await api.post("/admin/policies", payload);
      const policy = res.data?.policy || res.data;
      toast.success(`Hợp đồng #${policy.id} đã được tạo thành công!`);
      navigate("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Tạo hợp đồng thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tạo hợp đồng bảo hiểm mới</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Customer wallet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Địa chỉ ví khách hàng <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="customer_wallet"
            value={form.customer_wallet}
            onChange={handleChange}
            required
            placeholder="0x..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Policy type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loại bảo hiểm <span className="text-red-500">*</span>
          </label>
          <select
            name="policy_type"
            value={form.policy_type}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {POLICY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Premium */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phí bảo hiểm (ETH) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="premium_eth"
            value={form.premium_eth}
            onChange={handleChange}
            required
            min="0.0001"
            step="0.0001"
            placeholder="0.1"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Max coverage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mức bồi thường tối đa (ETH) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="max_coverage_eth"
            value={form.max_coverage_eth}
            onChange={handleChange}
            required
            min="0.001"
            step="0.001"
            placeholder="1.0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thời hạn (ngày) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="duration_days"
            value={form.duration_days}
            onChange={handleChange}
            required
            min="1"
            step="1"
            placeholder="365"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting ? "Đang tạo..." : "Tạo hợp đồng"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
