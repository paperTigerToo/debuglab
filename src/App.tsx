import { Route, Routes } from 'react-router'
import { Layout } from './site/Layout'
import { HomePage } from './pages/HomePage'
import { ConceptsPage } from './pages/ConceptsPage'
import { ConceptPage } from './pages/ConceptPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { IncidentLabPage } from './pages/IncidentLabPage'
import { IncidentPage } from './pages/IncidentPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="concepts" element={<ConceptsPage />} />
        <Route path="concepts/:conceptId" element={<ConceptPage />} />
        <Route path="playbook" element={<PlaybookPage />} />
        <Route path="lab" element={<IncidentLabPage />} />
        <Route path="lab/:incidentId" element={<IncidentPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
