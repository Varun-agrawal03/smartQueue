import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/events" className="flex items-center gap-2">
          {/* <span className="text-2xl">🎟️</span> */}
          <img src="/images/icon2.png" alt="smartqueue" className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold text-white">SmartQueue</span>
        </Link>

        <div className="flex items-center gap-6">
          {isAuthenticated ? (
            <>
              <Link
                to="/events"
                className="text-gray-300 hover:text-white transition"
              >
                Events
              </Link>
              <Link
                to="/my-bookings"
                className="text-gray-300 hover:text-white transition"
              >
                My Bookings
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">
                  👋 {user?.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-gray-300 hover:text-white transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;