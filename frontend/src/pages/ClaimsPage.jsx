import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";
import TxHash from "../components/ui/TxHash";

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/claims")
      .then((res) => setClaims(res.data?.claims || res.data || []))
      .catch((err) => setError(err?.response?.data?.error || "Không thể tải yêu cầu."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải yêu cầu..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Yêu cầu bồi thường</h1>
        <Link
          to="/claims/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Tạo yêu cầu mới
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {claims.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Chưa có yêu cầu bồi thường nào.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Hợp đồng</th>
                <th className="px-4 py-3 text-left">Số tiền (ETH)</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Tx Hash</th>
                <th className="px-4 py-3 text-left">Ngày tạo</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">#{claim.id}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {claim.policy_id ? (
                      <Link to={`/policies/${claim.policy_id}`} className="text-indigo-600 hover:underline">
                        #{claim.policy_id}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{claim.amount_eth}</td>
                  <td className="px-4 py-3">
                    <ClaimStatusBadge status={claim.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TxHash hash={claim.tx_hash} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {claim.created_at ? new Date(claim.created_at).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/claims/${claim.id}`}
                      className="text-indigo-600 hover:underline text-xs"
                    >
                      Chi tiết
                    </Link>
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
