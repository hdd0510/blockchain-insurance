import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import StatusBadge from "../components/ui/StatusBadge";
import TxHash from "../components/ui/TxHash";
import {
  listVerifications,
  submitManualAnswer,
} from "../services/hospital-service";
import { hospitalVerificationLabel } from "../utils/format";

/**
 * Hospital portal — used by users with role='hospital'.
 *
 * Each row is one VerificationRequested event the Oracle relayed. Most
 * are auto-answered by the oracle-service daemon using the deterministic
 * mock policy. Hospital operators can override with a manual answer when
 * the automation cannot decide.
 */
export default function HospitalPortalPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    listVerifications()
      .then(setRows)
      .catch((err) =>
        toast.error(err?.response?.data?.error || "Không tải được danh sách.")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleAnswer = async (id, verified) => {
    const note = window.prompt(
      `Ghi chú cho ${verified ? "VERIFIED" : "NOT VERIFIED"} (tùy chọn):`,
      ""
    );
    setWorking(id);
    try {
      await submitManualAnswer(id, { verified, note });
      toast.success("Đã ghi nhận kết luận thủ công");
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setWorking(null);
    }
  };

  if (loading) return <LoadingSpinner text="Đang tải yêu cầu xác minh..." />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Cổng bệnh viện</h1>
      <p className="text-sm text-gray-500 mb-6">
        Mỗi dòng dưới đây là một yêu cầu xác minh hồ sơ bệnh nhân do Oracle
        chuyển sang. Hệ thống chỉ tạo request pending; chính bệnh viện là actor
        xác minh thật và quyết định kết quả cuối cùng để fulfill on-chain.
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Chưa có yêu cầu xác minh nào.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Oracle Req</th>
                <th className="px-4 py-3 text-left">Claim</th>
                <th className="px-4 py-3 text-left">Patient hash</th>
                <th className="px-4 py-3 text-left">Record</th>
                <th className="px-4 py-3 text-left">Kết quả</th>
                <th className="px-4 py-3 text-left">Workflow</th>
                <th className="px-4 py-3 text-left">Ghi chú</th>
                <th className="px-4 py-3 text-left">Tx</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">#{v.id}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {v.oracle_request_id}
                  </td>
                  <td className="px-4 py-3">
                    {v.chain_claim_id ? (
                      <span className="font-mono text-xs">
                        #{v.chain_claim_id}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] break-all">
                      {v.patient_id_hash.slice(0, 14)}…
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {v.sourceRecord?.record_number ? (
                      <div className="text-xs">
                        <div className="font-medium">{v.sourceRecord.record_number}</div>
                        <div className="text-gray-500">{v.sourceRecord.patient_name}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={v.result}
                      label={hospitalVerificationLabel(v.result)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {v.status || "pending_manual"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={v.note}>
                    {v.note || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TxHash hash={v.oracle_tx_hash} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAnswer(v.id, true)}
                        disabled={working === v.id}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded disabled:opacity-50"
                      >
                        Verified
                      </button>
                      <button
                        onClick={() => handleAnswer(v.id, false)}
                        disabled={working === v.id}
                        className="bg-red-50 hover:bg-red-100 text-red-700 text-xs px-2 py-1 rounded disabled:opacity-50"
                      >
                        Not verified
                      </button>
                    </div>
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
