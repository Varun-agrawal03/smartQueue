import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import LandingPage from "./pages/LandingPage";
import Navbar from "./components/Navbar";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/register"  element={<RegisterPage />} />
        <Route
          path="/events"
          element={<ProtectedRoute><EventsPage /></ProtectedRoute>}
        />
        <Route
          path="/events/:id"
          element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>}
        />
        <Route
          path="/my-bookings"
          element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>}
        />
      </Routes>
    </div>
  );
}

export default App;