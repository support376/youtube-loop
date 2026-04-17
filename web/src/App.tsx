import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Crawling from './pages/Crawling'
import Editors from './pages/Editors'
import Videos from './pages/Videos'
import Insights from './pages/Insights'
import FeedbackPage from './pages/FeedbackPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/crawling" element={<Crawling />} />
          <Route path="/editors" element={<Editors />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
