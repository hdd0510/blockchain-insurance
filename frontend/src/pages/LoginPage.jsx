import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { connect } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const user = await connect();
      if (user) {
        toast.success(`Chào mừng, ${user.role === "admin" ? "Admin" : "Khách hàng"}!`);
        navigate("/dashboard");
      } else {
        toast.error("Kết nối thất bại. Vui lòng thử lại.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Lỗi xác thực ví.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="bg-indigo-600 text-white text-3xl w-16 h-16 rounded-2xl flex items-center justify-center shadow-md">
            ⛓
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">InsurChain</h1>
        <p className="text-gray-500 text-sm mb-8">Bảo hiểm trên blockchain — minh bạch, an toàn</p>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-colors"
        >
          {loading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Đang kết nối...
            </>
          ) : (
            <>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                alt="MetaMask"
                className="h-6 w-6"
              />
              Kết nối MetaMask
            </>
          )}
        </button>

        <p className="mt-6 text-xs text-gray-400">
          Cần cài MetaMask để sử dụng ứng dụng.{" "}
          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:underline"
          >
            Tải MetaMask
          </a>
        </p>
      </div>
    </div>
  );
}
