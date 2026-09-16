import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { SpacesPage } from './pages/SpacesPage'
import { ProgressPage } from './pages/ProgressPage'
import { MorePage } from './pages/MorePage'
import { WorkspacePage } from './components/workspace/WorkspacePage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/workspaces/:id" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
