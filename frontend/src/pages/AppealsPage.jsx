import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import StatusBadge from "../components/ui/StatusBadge";
import { listAppeals } from "../services/appeal-service";
import { appealStatusLabel } from "../utils/format";

export default function AppealsPage() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAppeals()
      .then(setAppeals)
      .catch((err) =>
        toast.error(err?.response?.data?.error || "Không tải được danh sách.")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải kháng cáo..." />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Kháng cáo</h1>
      <p className="text-sm text-gray-500 mb-6">
        Section 2.4 — danh sách các yêu cầu kháng cáo. Khách hàng nộp đơn từ
        trang chi tiết yêu cầu bồi thường khi yêu cầu bị từ chối.
      </p>

      {appeals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Chưa có đơn kháng cáo nào.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Claim</th>
                <th className="px-4 py-3 text-left">Người nộp</th>
                <th className="px-4 py-3 text-left">Lý do</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Nộp lúc</th>
                <th className="px-4 py-3 text-left">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appeals.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">#{a.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/claims/${a.claim_id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      Yêu cầu #{a.claim_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {a.appellant_wallet
                      ? `${a.appellant_wallet.slice(0, 6)}…${a.appellant_wallet.slice(-4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={a.reason}>
                    {a.reason}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={a.status}
                      label={appealStatusLabel(a.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(a.filed_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.resolved_at
                      ? new Date(a.resolved_at).toLocaleString("vi-VN")
                      : "—"}
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
