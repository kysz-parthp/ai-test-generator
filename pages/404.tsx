import Head from 'next/head'
import Link from 'next/link'

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found</title>
      </Head>
      <main className="container" style={{ textAlign: 'center', padding: '3rem' }}>
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <Link href="/" className="back-link" style={{ display: 'inline-block', marginTop: '1rem' }}>
          ← Go back home
        </Link>
      </main>
    </>
  )
}

