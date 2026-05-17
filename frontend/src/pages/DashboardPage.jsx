import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";
import { useAuth } from "../context/AuthContext";

/**
 * KPI card with icon, value, label, and trend indicator.
 */
function KpiCard({ label, value, suffix = "", subtext, accent = "indigo", icon }) {
  const accentMap = {
    indigo: { text: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    amber: { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    rose: { text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
  };
  const a = accentMap[accent] || accentMap.indigo;
  return (
    <div className={`bg-white rounded-xl border ${a.border} shadow-sm p-5 relative overflow-hidden`}>
      <div className={`absolute top-3 right-3 w-10 h-10 ${a.bg} ${a.text} rounded-lg flex items-center justify-center text-lg font-bold`}>
        {icon}
      </div>
      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${a.text}`}>
        {value}
        {suffix && <span className="text-base font-medium ml-1 opacity-70">{suffix}</span>}
      </p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}

/**
 * Mini bar showing claim status breakdown counts horizontally.
 */
function StatusBreakdown({ items, total }) {
  const COLORS = {
    paid: "bg-emerald-500",
    approved: "bg-blue-500",
    pending: "bg-amber-500",
    under_review: "bg-purple-500",
    needs_info: "bg-orange-500",
    rejected: "bg-rose-500",
  };
  const LABELS = {
    paid: "Đã thanh toán",
    approved: "Đã duyệt",
    pending: "Chờ xử lý",
    under_review: "Đang xem xét",
    needs_info: "Cần bổ sung",
    rejected: "Từ chối",
  };
  if (!total) return null;
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
        {items.map((item) => {
          const pct = (Number(item.count) / total) * 100;
          return (
            <div
              key={item.status}
              className={COLORS[item.status] || "bg-gray-400"}
              style={{ width: `${pct}%` }}
              title={`${LABELS[item.status]}: ${item.count}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.status} className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${COLORS[item.status] || "bg-gray-400"}`} />
            <span className="text-gray-600">{LABELS[item.status] || item.status}</span>
            <span className="ml-auto font-semibold text-gray-800">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pRes, cRes, sRes] = await Promise.all([
          api.get("/policies"),
          api.get("/claims"),
          api.get("/public/stats"),
        ]);
        setPolicies(pRes.data?.policies || pRes.data || []);
        setClaims(cRes.data?.claims || cRes.data || []);
        setStats(sRes.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải..." />;

  // Personal KPIs (from user's own data)
  const activePolicies = policies.filter((p) => p.status === "active").length;
  const pendingClaims = claims.filter((c) => ["pending", "under_review", "needs_info"].includes(c.status)).length;
  const paidClaims = claims.filter((c) => c.status === "paid");
  const personalPaid = paidClaims.reduce((sum, c) => sum + Number(c.amount_eth || 0), 0);
  const totalCoverage = policies
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + Number(p.max_coverage_eth || 0), 0);

  const recentClaims = [...claims]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? "Toàn hệ thống" : "Hợp đồng và yêu cầu của bạn"}
          </p>
        </div>
        <Link
          to="/transactions"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          On-chain Explorer →
        </Link>
      </div>

      {/* Personal KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Hợp đồng đang hoạt động"
          value={activePolicies}
          subtext={`Tổng ${policies.length} hợp đồng`}
          accent="indigo"
          icon="📋"
        />
        <KpiCard
          label="Tổng bảo hiểm"
          value={totalCoverage.toFixed(2)}
          suffix="ETH"
          subtext="Mức bồi thường tối đa"
          accent="emerald"
          icon="🛡"
        />
        <KpiCard
          label="Yêu cầu chờ xử lý"
          value={pendingClaims}
          subtext={`Tổng ${claims.length} yêu cầu`}
          accent="amber"
          icon="⏳"
        />
        <KpiCard
          label="Đã nhận bồi thường"
          value={personalPaid.toFixed(3)}
          suffix="ETH"
          subtext={`${paidClaims.length} claim đã thanh toán`}
          accent="rose"
          icon="💰"
        />
      </div>

      {/* System-wide stats (cho cả admin và customer xem được) */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-700">Thống kê toàn hệ thống</h2>
            <span className="text-xs text-gray-400 font-mono">on-chain · cập nhật real-time</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Tổng hợp đồng</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.policies.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Còn hiệu lực</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.policies.active}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Tổng giao dịch</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.claims.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Đã bồi thường</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {Number(stats.payouts_eth || 0).toFixed(3)}
                <span className="text-sm font-medium ml-1 opacity-70">ETH</span>
              </p>
            </div>
          </div>
          {stats.claims.by_status?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Phân bố trạng thái</p>
              <StatusBreakdown items={stats.claims.by_status} total={stats.claims.total} />
            </div>
          )}
        </div>
      )}

      {/* Recent claims */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Yêu cầu gần đây của bạn</h2>
          <Link to="/claims" className="text-sm text-indigo-600 hover:underline">
            Xem tất cả →
          </Link>
        </div>

        {recentClaims.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Chưa có yêu cầu bồi thường nào.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    to={`/claims/${claim.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-indigo-600"
                  >
                    Yêu cầu #{claim.id}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString("vi-VN") : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 font-mono">
                    {Number(claim.amount_eth).toFixed(3)} ETH
                  </span>
                  <ClaimStatusBadge status={claim.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex gap-3 flex-wrap">
        <Link
          to="/claims/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          + Tạo yêu cầu bồi thường
        </Link>
        <Link
          to="/policies"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Xem hợp đồng
        </Link>
        <Link
          to="/transactions"
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          ⛓ On-chain Explorer
        </Link>
      </div>
    </div>
  );
}
