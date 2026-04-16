import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/layout/MainLayout'
import { I18nProvider } from './i18n/I18nProvider'
import { DashboardPage } from './pages/DashboardPage'
import { TaskListPage } from './pages/TaskListPage'
import { NewTaskPage } from './pages/NewTaskPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { ToolListPage } from './pages/ToolListPage'
import { ToolPage } from './pages/ToolPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="tasks" element={<TaskListPage />} />
              <Route path="tasks/new" element={<NewTaskPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="tools" element={<ToolListPage />} />
              <Route path="tools/:toolId" element={<ToolPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}
