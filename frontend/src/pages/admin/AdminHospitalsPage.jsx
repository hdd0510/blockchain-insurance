import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { listVerifications, registerHospital } from "../../services/hospital-service";

/**
 * Admin → Hospitals registry. Lets admins whitelist a hospital wallet
 * both on-chain (HospitalRegistry) and off-chain (users table).
 */
export default function AdminHospitalsPage() {
  const [verifications, setVerifications] = useState([]);
  const [form, setForm] = useState({
    wallet: "",
    name: "",
    api_endpoint: "http://localhost:3001/api/hospital",
  });
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listVerifications()
      .then(setVerifications)
      .catch((err) =>
        toast.error(err?.response?.data?.error || "Không tải được verifications.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.wallet)) {
      return toast.error("Wallet không hợp lệ");
    }
    setWorking(true);
    try {
      await registerHospital(form);
      toast.success("Đã đăng ký bệnh viện (on-chain + off-chain)");
      setForm({ ...form, wallet: "", name: "" });
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  // Unique hospital wallets observed in verification rows
  const hospitalsSeen = Array.from(
    new Map(verifications.map((v) => [v.hospital_wallet, v])).values()
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Đăng ký bệnh viện
      </h1>

      <form
        onSubmit={submit}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wallet bệnh viện <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.wallet}
            onChange={(e) => setForm({ ...form, wallet: e.target.value })}
            placeholder="0x..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tên bệnh viện <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="VD: Bệnh viện ABC"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API endpoint (off-chain)
          </label>
          <input
            type="text"
            value={form.api_endpoint}
            onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
            placeholder="http://hospital.example/api"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={working}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm"
        >
          {working ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>

      <h2 className="text-base font-semibold text-gray-700 mb-3">
        Bệnh viện đã từng nhận yêu cầu Oracle
      </h2>
      {hospitalsSeen.length === 0 ? (
        <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Wallet</th>
                <th className="px-4 py-3 text-left">Số request gần đây</th>
                <th className="px-4 py-3 text-left">Cập nhật cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hospitalsSeen.map((h) => (
                <tr key={h.hospital_wallet} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {h.hospital_wallet}
                  </td>
                  <td className="px-4 py-3">
                    {
                      verifications.filter(
                        (v) => v.hospital_wallet === h.hospital_wallet
                      ).length
                    }
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(h.updated_at).toLocaleString("vi-VN")}
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
