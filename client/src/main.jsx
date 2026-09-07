import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DoubleCheckProvider from './components/Shared/DoubleCheckComponents/core/DoubleCheckProvider.jsx'
import InputExampleDecorator from './components/Shared/InputExampleDecorator.jsx'
import UploadSecurityProvider from './components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DoubleCheckProvider>
        <UploadSecurityProvider>
          <InputExampleDecorator />
          <App />
        </UploadSecurityProvider>
      </DoubleCheckProvider>
    </QueryClientProvider>
  </StrictMode>,
)
