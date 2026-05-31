import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Router } from 'wouter'
import App from './App.tsx'
import './index.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
          <h2>出了點問題</h2>
          <p>請重新整理頁面</p>
          <button onClick={() => window.location.reload()}>重新整理</button>
        </div>
      )
    }

    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!clientId) {
  console.error('❌ 缺少 VITE_GOOGLE_CLIENT_ID 環境變數')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={clientId}>
          <Router>
            <App />
          </Router>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
