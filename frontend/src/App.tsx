import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AwardCaseCreatePage from "./pages/AwardCaseCreatePage";
import RecipientListPage from "./pages/RecipientListPage";
import RecipientEditPage from "./pages/RecipientEditPage";
import MeritContentEditPage from "./pages/MeritContentEditPage";
import DocumentPreviewPage from "./pages/DocumentPreviewPage";
import DownloadPage from "./pages/DownloadPage";
import ChecklistPage from "./pages/ChecklistPage";
import ApplicationFormPage from "./pages/ApplicationFormPage";
import AddRecipientPage from "./pages/AddRecipientPage";
import ManageApplicationPage from "./pages/ManageApplicationPage";
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
      {/* 기관 대표 공유 링크 — 피추천자 본인이 자기 정보 추가 */}
      <Route path="/apply/add/:token" element={<AddRecipientPage />} />
      {/* 기관 대표 전용 — 검토·최종 제출 관리 */}
      <Route path="/apply/manage/:token" element={<ManageApplicationPage />} />
      <Route element={<Layout />}>
        {/* 관리·전체현황 통합 페이지 */}
        <Route path="/" element={<AllCasesPage />} />
        <Route path="/quota" element={<QuotaPage />} />
        {/* 구 '전체 표창 현황' 경로 — 통합 페이지로 리다이렉트(북마크 호환) */}
        <Route path="/all-cases" element={<Navigate to="/" replace />} />
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
