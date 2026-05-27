import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../../components/claim/ClaimStatusBadge";

function StatCard({ label, value, color = "indigo" }) {
  const colors = {
    indigo: "text-indigo-600",
    green: "text-green-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color] || "text-gray-800"}`}>{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get("/policies"),
          api.get("/claims"),
        ]);
        setPolicies(pRes.data?.policies || pRes.data || []);
        setClaims(cRes.data?.claims || cRes.data || []);
      } catch (err) {
        console.error("Admin dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải..." />;

  const statusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const recentPending = claims
    .filter((c) => c.status === "pending")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/admin/policies/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Tạo hợp đồng
          </Link>
          <Link
            to="/admin/claims"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Yêu cầu (multi-sig)
          </Link>
          <Link
            to="/admin/hospitals"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Bệnh viện
          </Link>
          <Link
            to="/admin/audit-logs"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Audit logs
          </Link>
          <Link
            to="/appeals"
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Kháng cáo
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng hợp đồng" value={policies.length} color="indigo" />
        <StatCard label="Tổng yêu cầu" value={claims.length} color="blue" />
        <StatCard label="Chờ xử lý" value={statusCounts["pending"] || 0} color="yellow" />
        <StatCard label="Đã duyệt" value={statusCounts["approved"] || 0} color="green" />
      </div>

      {/* Claims by status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[
          { key: "under_review", label: "Đang xem xét", color: "blue" },
          { key: "rejected", label: "Từ chối", color: "red" },
          { key: "paid", label: "Đã thanh toán", color: "green" },
        ].map(({ key, label, color }) => (
          <StatCard key={key} label={label} value={statusCounts[key] || 0} color={color} />
        ))}
      </div>

      {/* Recent pending claims */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Yêu cầu chờ xử lý gần đây</h2>
          <Link to="/admin/claims" className="text-sm text-indigo-600 hover:underline">
            Xem tất cả →
          </Link>
        </div>

        {recentPending.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Không có yêu cầu nào đang chờ.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentPending.map((claim) => (
              <div key={claim.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    to={`/claims/${claim.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-indigo-600"
                  >
                    Yêu cầu #{claim.id}
                  </Link>
                  <p className="text-xs text-gray-400">
                    Hợp đồng #{claim.policy_id} •{" "}
                    {claim.created_at ? new Date(claim.created_at).toLocaleDateString("vi-VN") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{claim.amount_eth} ETH</span>
                  <ClaimStatusBadge status={claim.status} />
                  <Link
                    to="/admin/claims"
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded transition-colors"
                  >
                    Xử lý
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
