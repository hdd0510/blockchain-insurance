import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";

/**
 * Public transaction explorer page.
 * Anyone can view all on-chain claims — demonstrates blockchain transparency.
 * No authentication required.
 */
function StatCard({ label, value, suffix = "", color = "indigo" }) {
  const palette = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    green: "text-emerald-600 bg-emerald-50 border-emerald-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
  };
  return (
    <div className={`rounded-xl border p-5 ${palette[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-2">
        {value}
        {suffix && <span className="text-base font-medium ml-1 opacity-70">{suffix}</span>}
      </p>
    </div>
  );
}

function TxHashCell({ hash }) {
  if (!hash) return <span className="text-gray-400 text-xs">—</span>;
  const short = `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  return (
    <code
      className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-100"
      title={hash}
      onClick={() => navigator.clipboard?.writeText(hash)}
    >
      {short}
    </code>
  );
}

const POLICY_TYPE_LABEL = {
  vehicle: "Xe cộ",
  health: "Sức khỏe",
  travel: "Du lịch",
  property: "Tài sản",
  accident: "Tai nạn",
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchData() {
      try {
        const [txRes, statsRes] = await Promise.all([
          api.get("/public/transactions?limit=100"),
          api.get("/public/stats"),
        ]);
        setTransactions(txRes.data.transactions || []);
        setStats(statsRes.data);
      } catch (err) {
        console.error("Transactions fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải lịch sử on-chain..." />;

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.status === filter);

  const STATUS_FILTERS = [
    { key: "all", label: "Tất cả" },
    { key: "paid", label: "Đã thanh toán" },
    { key: "approved", label: "Đã duyệt" },
    { key: "pending", label: "Chờ xử lý" },
    { key: "rejected", label: "Từ chối" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
              ⛓ On-chain Explorer
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử giao dịch bồi thường</h1>
          <p className="text-gray-600 mt-2 max-w-2xl text-sm">
            Toàn bộ yêu cầu bồi thường được ghi nhận trên blockchain — minh bạch, không thể chỉnh sửa.
            Bất kỳ ai cũng có thể kiểm chứng tính xác thực thông qua transaction hash.
          </p>
        </div>

        {/* KPI Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Tổng hợp đồng" value={stats.policies.total} color="indigo" />
            <StatCard label="Hợp đồng còn hiệu lực" value={stats.policies.active} color="green" />
            <StatCard label="Tổng giao dịch" value={stats.claims.total} color="purple" />
            <StatCard
              label="Tổng bồi thường"
              value={Number(stats.payouts_eth || 0).toFixed(3)}
              suffix="ETH"
              color="amber"
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Transactions table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 text-left">Chain ID</th>
                  <th className="px-5 py-3 text-left">Loại</th>
                  <th className="px-5 py-3 text-left">Người yêu cầu</th>
                  <th className="px-5 py-3 text-right">Số tiền</th>
                  <th className="px-5 py-3 text-left">Trạng thái</th>
                  <th className="px-5 py-3 text-left">Tx Hash</th>
                  <th className="px-5 py-3 text-left">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                      Không có giao dịch phù hợp.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">#{t.chain_claim_id}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {POLICY_TYPE_LABEL[t.policy_type] || t.policy_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{t.claimant}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800 font-mono">
                        {Number(t.amount_eth).toFixed(3)} ETH
                      </td>
                      <td className="px-5 py-3">
                        <ClaimStatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3"><TxHashCell hash={t.tx_hash} /></td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {t.submitted_at ? new Date(t.submitted_at).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
            Hiển thị {filtered.length} / {transactions.length} giao dịch · Click tx hash để copy
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {user ? (
            <>
              <Link to="/dashboard" className="text-indigo-600 hover:underline font-medium">
                ← Về Dashboard
              </Link>
              {" · "}
              <Link to="/claims" className="text-indigo-600 hover:underline font-medium">
                Yêu cầu của tôi
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                Đăng nhập
              </Link>
              {" "}để tạo hợp đồng và nộp yêu cầu bồi thường của riêng bạn.
            </>
          )}
        </div>
    </div>
  );
}
