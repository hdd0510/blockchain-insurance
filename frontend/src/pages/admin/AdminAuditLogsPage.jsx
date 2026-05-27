import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { listAuditLogs } from "../../services/audit-service";
import TxHash from "../../components/ui/TxHash";

const ENTITY_TYPES = ["", "policy", "claim", "appeal", "user", "hospital_verification"];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({
    entity_type: "",
    entity_id: "",
    user_wallet: "",
    action: "",
  });
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v)
    );
    listAuditLogs({ ...params, limit: 200 })
      .then((res) => {
        setLogs(res.rows || []);
        setCount(res.count || 0);
      })
      .catch((err) =>
        toast.error(err?.response?.data?.error || "Không tải được audit logs.")
      )
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Audit logs (off-chain)
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Section 2.6 — mọi hành động ghi vào database đều được lưu ở đây để
        truy vết. {count} mục.
      </p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={filters.entity_type}
          onChange={(e) =>
            setFilters((f) => ({ ...f, entity_type: e.target.value }))
          }
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || "(tất cả entity)"}
            </option>
          ))}
        </select>
        <input
          placeholder="Entity ID"
          value={filters.entity_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, entity_id: e.target.value }))
          }
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="User wallet"
          value={filters.user_wallet}
          onChange={(e) =>
            setFilters((f) => ({ ...f, user_wallet: e.target.value }))
          }
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <input
          placeholder="Action (chứa...)"
          value={filters.action}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value }))
          }
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Không có log phù hợp filter hiện tại.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Khi</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Old → New</th>
                <th className="px-3 py-2 text-left">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {row.user_wallet
                      ? `${row.user_wallet.slice(0, 6)}…${row.user_wallet.slice(-4)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{row.user_role || "—"}</td>
                  <td className="px-3 py-2 font-semibold text-indigo-700">
                    {row.action}
                  </td>
                  <td className="px-3 py-2">
                    {row.entity_type}#{row.entity_id}
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-gray-500">
                        diff
                      </summary>
                      <pre className="bg-gray-50 mt-1 p-2 rounded text-[10px] overflow-x-auto">
{JSON.stringify(row.old_value, null, 2)}
{"  →  "}
{JSON.stringify(row.new_value, null, 2)}
                      </pre>
                    </details>
                  </td>
                  <td className="px-3 py-2">
                    <TxHash hash={row.tx_hash} />
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
