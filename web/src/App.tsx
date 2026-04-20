import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PlanLayout from './pages/PlanLayout'
import PerformanceLayout from './pages/PerformanceLayout'

// 기획
import Crawling from './pages/Crawling'
import PlanDraft from './pages/PlanDraft'
import FeedbackPage from './pages/FeedbackPage'
import PlanHistory from './pages/PlanHistory'

// 성과
import Overview from './pages/Overview'
import Videos from './pages/Videos'
import Editors from './pages/Editors'
import Insights from './pages/Insights'

// 기타
import DataManagement from './pages/DataManagement'
import Leads from './pages/Leads'
import Agents from './pages/Agents'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* 기본 랜딩 → 성과 > Overview */}
          <Route index element={<Navigate to="/performance/overview" replace />} />

          {/* 기획 */}
          <Route path="plan" element={<PlanLayout />}>
            <Route index element={<Navigate to="/plan/crawling" replace />} />
            <Route path="crawling" element={<Crawling />} />
            <Route path="draft" element={<PlanDraft />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="history" element={<PlanHistory />} />
          </Route>

          {/* 성과 */}
          <Route path="performance" element={<PerformanceLayout />}>
            <Route index element={<Navigate to="/performance/overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="videos" element={<Videos />} />
            <Route path="editors" element={<Editors />} />
            <Route path="insights" element={<Insights />} />
          </Route>

          {/* 단일 탭 */}
          <Route path="data" element={<DataManagement />} />
          <Route path="leads" element={<Leads />} />
          <Route path="agents" element={<Agents />} />

          {/* 알 수 없는 경로 */}
          <Route path="*" element={<Navigate to="/performance/overview" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
