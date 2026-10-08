import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '@/providers/toast-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { loadWebEnv } from '@/lib/env'
import { SetupRequiredPage } from '@/pages/setup-required'
import { AppRoutes } from '@/routes'
import { ThemeProvider } from '@/providers/theme-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

export default function App() {
  const env = loadWebEnv()
  return (
    <ThemeProvider>
      {!env ? (
        <SetupRequiredPage />
      ) : (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider env={env}>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      )}
    </ThemeProvider>
  )
}
