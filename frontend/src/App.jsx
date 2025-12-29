import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MLPersonalizationEngineLayout from "./layouts/MLPersonalizationEngineLayout";

import Dashboard from "./pages/Dashboard";
import TemporaryUserDetector from "./pages/TemporaryUserDetector";
import CategoryEngine from "./pages/CategoryEngine";
import UserEngine from "./pages/UserEngine";

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
