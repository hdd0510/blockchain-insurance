import { useState, useEffect } from "react";
import api from "../services/api";
import PolicyCard from "../components/policy/PolicyCard";
import LoadingSpinner from "../components/ui/LoadingSpinner";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/policies")
      .then((res) => setPolicies(res.data?.policies || res.data || []))
      .catch((err) => setError(err?.response?.data?.error || "Không thể tải hợp đồng."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Đang tải hợp đồng..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Hợp đồng bảo hiểm</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {policies.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Chưa có hợp đồng nào.</p>
          <p className="text-sm mt-1">Liên hệ admin để được cấp hợp đồng bảo hiểm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {policies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}
