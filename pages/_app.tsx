import type { AppProps } from 'next/app'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  try {
    return <Component {...pageProps} />
  } catch (error) {
    console.error('Error in App component:', error)
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Application Error</h1>
        <p>An error occurred. Please refresh the page.</p>
      </div>
    )
  }
}

