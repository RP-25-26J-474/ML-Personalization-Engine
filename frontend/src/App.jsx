import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MLPersonalizationEngineLayout from "./layouts/MLPersonalizationEngineLayout";

import Dashboard from "./pages/Dashboard";
import TemporaryUserDetector from "./pages/TemporaryUserDetector";
import CategoryEngine from "./pages/CategoryEngine";
import UserEngine from "./pages/UserEngine";
import TrainModels from "./pages/TrainModels";
import AdminUsers from "./pages/AdminUsers";
import AdminUserProfile from "./pages/AdminUserProfile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MLPersonalizationEngineLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="temporary-user-detector" element={<TemporaryUserDetector />} />
          <Route path="category-engine" element={<CategoryEngine />} />
          <Route path="user-engine" element={<UserEngine />} />
          <Route path="train" element={<TrainModels />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/users/:userId" element={<AdminUserProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
