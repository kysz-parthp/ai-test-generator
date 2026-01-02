import { NextPageContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'

interface ErrorProps {
  statusCode?: number
  hasGetInitialPropsRun?: boolean
  err?: Error
}

function Error({ statusCode }: ErrorProps) {
  return (
    <>
      <Head>
        <title>Error {statusCode || 'Unknown'}</title>
      </Head>
      <main className="container" style={{ textAlign: 'center', padding: '3rem' }}>
        <h1>Error {statusCode || 'Unknown'}</h1>
        <p>
          {statusCode === 404
            ? 'This page could not be found.'
            : statusCode === 500
            ? 'An error occurred on the server.'
            : 'An unexpected error occurred.'}
        </p>
        <Link href="/" className="back-link" style={{ display: 'inline-block', marginTop: '1rem' }}>
          ← Go back home
        </Link>
      </main>
    </>
  )
}

Error.getInitialProps = ({ res, err, asPath }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any)?.statusCode : 404
  return { statusCode, hasGetInitialPropsRun: true }
}

export default Error
