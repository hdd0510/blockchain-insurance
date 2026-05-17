import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import StatusBadge from "../components/ui/StatusBadge";
import ClaimStatusBadge from "../components/claim/ClaimStatusBadge";
import { weiToEth, policyStatusLabel } from "../utils/format";

const POLICY_TYPE_LABEL = {
  health: "Bảo hiểm sức khỏe",
  car: "Bảo hiểm xe hơi",
  home: "Bảo hiểm nhà",
  life: "Bảo hiểm nhân thọ",
};

export default function PolicyDetailPage() {
  const { id } = useParams();
  const [policy, setPolicy] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get(`/policies/${id}`),
          api.get(`/claims?policy_id=${id}`),
        ]);
        setPolicy(pRes.data?.policy || pRes.data);
        setClaims(cRes.data?.claims || cRes.data || []);
      } catch (err) {
        setError(err?.response?.data?.error || "Không thể tải thông tin hợp đồng.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <LoadingSpinner text="Đang tải..." />;
  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>
    </div>
  );
  if (!policy) return null;

  const coverageEth = policy.max_coverage_eth || (policy.max_coverage ? weiToEth(policy.max_coverage) : "—");
  const premiumEth = policy.premium_eth || (policy.premium ? weiToEth(policy.premium) : "—");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/policies" className="hover:text-indigo-600">Hợp đồng</Link>
        <span>/</span>
        <span className="text-gray-600">#{id}</span>
      </div>

      {/* Policy details card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {POLICY_TYPE_LABEL[policy.policy_type] || policy.policy_type}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Hợp đồng #{policy.id}</p>
          </div>
          <StatusBadge status={policy.status} label={policyStatusLabel(policy.status)} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Phí bảo hiểm</p>
            <p className="font-semibold text-gray-800">{premiumEth} ETH</p>
          </div>
          <div>
            <p className="text-gray-400">Bảo hiểm tối đa</p>
            <p className="font-semibold text-indigo-600">{coverageEth} ETH</p>
          </div>
          <div>
            <p className="text-gray-400">Ngày bắt đầu</p>
            <p className="font-medium text-gray-700">
              {policy.start_date ? new Date(policy.start_date).toLocaleDateString("vi-VN") : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Ngày hết hạn</p>
            <p className="font-medium text-gray-700">
              {policy.end_date ? new Date(policy.end_date).toLocaleDateString("vi-VN") : "—"}
            </p>
          </div>
          {policy.chain_policy_id && (
            <div className="col-span-2">
              <p className="text-gray-400">Chain Policy ID</p>
              <p className="font-mono text-xs text-gray-600">{policy.chain_policy_id}</p>
            </div>
          )}
        </div>
      </div>

      {/* Claims list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">
            Yêu cầu bồi thường ({claims.length})
          </h2>
          <Link
            to="/claims/new"
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            + Tạo yêu cầu
          </Link>
        </div>

        {claims.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Chưa có yêu cầu nào cho hợp đồng này.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {claims.map((claim) => (
              <div key={claim.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link to={`/claims/${claim.id}`} className="text-sm font-medium text-gray-800 hover:text-indigo-600">
                    Yêu cầu #{claim.id}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {claim.created_at ? new Date(claim.created_at).toLocaleDateString("vi-VN") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{claim.amount_eth} ETH</span>
                  <ClaimStatusBadge status={claim.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
