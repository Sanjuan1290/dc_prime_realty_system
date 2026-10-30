import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DoubleCheckProvider from './components/Shared/DoubleCheckComponents/core/DoubleCheckProvider.jsx'
import InputExampleDecorator from './components/Shared/InputExampleDecorator.jsx'
import UploadSecurityProvider from './components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const App = lazy(() => import('./App.jsx'))

const loadingScreen = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5">
    <p className="font-black text-white">Loading Realty...</p>
  </main>
)

const application = (
  <DoubleCheckProvider>
    <UploadSecurityProvider>
      <InputExampleDecorator />
      <Suspense fallback={loadingScreen()}><App /></Suspense>
    </UploadSecurityProvider>
  </DoubleCheckProvider>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {application}
    </QueryClientProvider>
  </StrictMode>,
)



