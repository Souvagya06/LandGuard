import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import SendAlert from './pages/SendAlert'
import SimulationStudio from './pages/SimulationStudio'
import FieldReports from './pages/FieldReports'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard.html" element={<Dashboard />} />
            <Route path="/simulate" element={<SimulationStudio />} />
            <Route path="/simulate.html" element={<SimulationStudio />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/alerts.html" element={<Alerts />} />
            <Route path="/send-alert" element={<SendAlert />} />
            <Route path="/send-alert.html" element={<SendAlert />} />
            <Route path="/reports" element={<FieldReports />} />
            <Route path="/reports.html" element={<FieldReports />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
