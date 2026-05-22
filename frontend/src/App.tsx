import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import AwardCaseCreatePage from "./pages/AwardCaseCreatePage";
import RecipientListPage from "./pages/RecipientListPage";
import RecipientEditPage from "./pages/RecipientEditPage";
import MeritContentEditPage from "./pages/MeritContentEditPage";
import DocumentPreviewPage from "./pages/DocumentPreviewPage";
import DownloadPage from "./pages/DownloadPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/cases/new" element={<AwardCaseCreatePage />} />
        <Route path="/cases/:caseId" element={<RecipientListPage />} />
        <Route path="/cases/:caseId/recipients/new" element={<RecipientEditPage />} />
        <Route path="/recipients/:recipientId" element={<RecipientEditPage />} />
        <Route path="/recipients/:recipientId/merit" element={<MeritContentEditPage />} />
        <Route path="/recipients/:recipientId/preview" element={<DocumentPreviewPage />} />
        <Route path="/cases/:caseId/download" element={<DownloadPage />} />
      </Route>
    </Routes>
  );
}
