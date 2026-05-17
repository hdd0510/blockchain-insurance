import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { shortAddr } from "../../utils/format";

export default function Navbar() {
  const { user, isAdmin, account, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-indigo-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-2xl">⛓</span>
            InsurChain
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className="hover:text-indigo-200 transition-colors">
              Dashboard
            </Link>
            <Link to="/policies" className="hover:text-indigo-200 transition-colors">
              Hợp đồng
            </Link>
            <Link to="/claims" className="hover:text-indigo-200 transition-colors">
              Yêu cầu bồi thường
            </Link>
            <Link to="/transactions" className="hover:text-indigo-200 transition-colors">
              On-chain Explorer
            </Link>
            {isAdmin && (
              <Link to="/admin" className="bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors">
                Admin Panel
              </Link>
            )}
          </div>

          {/* Wallet info + logout */}
          <div className="flex items-center gap-3 text-sm">
            {account && (
              <span className="bg-indigo-800 px-3 py-1 rounded-full font-mono text-xs text-indigo-200">
                {shortAddr(account)}
              </span>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="bg-white text-indigo-700 hover:bg-indigo-50 px-3 py-1 rounded-md font-medium text-xs transition-colors"
              >
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
