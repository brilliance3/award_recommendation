import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import AwardCaseCreatePage from "./pages/AwardCaseCreatePage";
import RecipientListPage from "./pages/RecipientListPage";
import RecipientEditPage from "./pages/RecipientEditPage";
import MeritContentEditPage from "./pages/MeritContentEditPage";
import DocumentPreviewPage from "./pages/DocumentPreviewPage";
import DownloadPage from "./pages/DownloadPage";
import ChecklistPage from "./pages/ChecklistPage";
import ApplicationFormPage from "./pages/ApplicationFormPage";
import AdminReviewPage from "./pages/AdminReviewPage";
import QuotaPage from "./pages/QuotaPage";
import AllCasesPage from "./pages/AllCasesPage";
import SettingsPage from "./pages/SettingsPage";
import TrashPage from "./pages/TrashPage";

export default function App() {
  return (
    <Routes>
      {/* 민간인 공용 신청 폼 — Layout 없이 단독 */}
      <Route path="/apply" element={<ApplicationFormPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/quota" element={<QuotaPage />} />
        <Route path="/all-cases" element={<AllCasesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/cases/new" element={<AwardCaseCreatePage />} />
        <Route path="/cases/:caseId" element={<RecipientListPage />} />
        <Route path="/cases/:caseId/recipients/new" element={<RecipientEditPage />} />
        <Route path="/recipients/:recipientId" element={<RecipientEditPage />} />
        <Route path="/recipients/:recipientId/checklist" element={<ChecklistPage />} />
        <Route path="/recipients/:recipientId/merit" element={<MeritContentEditPage />} />
        <Route path="/recipients/:recipientId/preview" element={<DocumentPreviewPage />} />
        <Route path="/recipients/:recipientId/admin-review" element={<AdminReviewPage />} />
        <Route path="/cases/:caseId/download" element={<DownloadPage />} />
      </Route>
    </Routes>
  );
}
