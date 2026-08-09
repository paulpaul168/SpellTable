import Script from 'next/script'

const DEFAULT_SCRIPT_URL = 'https://analytics.paulhoeller.at/script.js'

export default function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  if (!websiteId) {
    return null
  }

  const scriptUrl =
    process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || DEFAULT_SCRIPT_URL

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  )
}
