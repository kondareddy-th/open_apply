import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { BASE_PATH } from './config'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const ResumePage = lazy(() => import('./pages/Resume'))
const Applications = lazy(() => import('./pages/Applications'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Emails = lazy(() => import('./pages/Emails'))
const InterviewPrep = lazy(() => import('./pages/InterviewPrep'))
const Notes = lazy(() => import('./pages/Notes'))
const Concepts = lazy(() => import('./pages/Concepts'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="applications" element={<Applications />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="emails" element={<Emails />} />
            <Route path="interview-prep" element={<InterviewPrep />} />
            <Route path="notes" element={<Notes />} />
            <Route path="concepts" element={<Concepts />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
