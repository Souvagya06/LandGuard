import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import SendAlert from './pages/SendAlert'
import SimulationStudio from './pages/SimulationStudio'
import FieldReports from './pages/FieldReports'
import SystemStatusPage from './pages/System'
import Login from './pages/Login'
import { fetchAuthConfig, readSession } from './lib/api'
import { LandGuardLogo } from './components/brand'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function useSessionVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener('landguard:session', bump)
    return () => window.removeEventListener('landguard:session', bump)
  }, [])
  return version
}

function Splash({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-forest-night text-mist">
      <LandGuardLogo size={72} />
      <p className="text-[13px] text-mist-muted">{message}</p>
    </div>
  )
}

/** Production requires an authority sign-in; development servers do not. */
function AuthGate({ children }: { children: ReactNode }) {
  useSessionVersion()
  const config = useQuery({ queryKey: ['auth-config'], queryFn: fetchAuthConfig, retry: 2, staleTime: Infinity })
  if (config.isLoading) return <Splash message="Connecting to LandGuard…" />
  if (config.isError) {
    return <Splash message="The LandGuard API cannot be reached. The control center will retry automatically." />
  }
  if (config.data?.authRequired && !readSession()) return <Login />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard.html" element={<Dashboard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alerts.html" element={<Alerts />} />
              <Route path="/send-alert" element={<SendAlert />} />
              <Route path="/send-alert.html" element={<SendAlert />} />
              <Route path="/reports" element={<FieldReports />} />
              <Route path="/reports.html" element={<FieldReports />} />
              <Route path="/simulate" element={<SimulationStudio />} />
              <Route path="/simulate.html" element={<SimulationStudio />} />
              <Route path="/system" element={<SystemStatusPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
