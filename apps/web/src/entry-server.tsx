// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "../shared/site-config.ts";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />

          {/* Global SEO defaults — per-page tags from @solidjs/meta override these */}
          <meta name="robots" content="index, follow, max-image-preview:large" />
          <meta name="description" content={SITE_DESCRIPTION} />
          <meta
            name="keywords"
            content="OSINT dashboard, conflict monitoring, milblogger aggregator, telegram OSINT, military aircraft tracker, war intelligence, Ukraine war tracker, Middle East conflict monitor, open source intelligence, real-time intelligence"
          />
          <meta name="author" content={SITE_NAME} />

          {/* Open Graph defaults */}
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:type" content="website" />
          <meta property="og:locale" content="en_US" />

          {/* Twitter Card defaults */}
          <meta name="twitter:card" content="summary_large_image" />

          {/* Sitemap discovery */}
          <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

          {/* JSON-LD: WebApplication structured data */}
          <script
            type="application/ld+json"
            innerHTML={JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              url: SITE_ORIGIN,
              description: SITE_DESCRIPTION,
              applicationCategory: "SecurityApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_ORIGIN,
              },
              featureList: [
                "Real-time Telegram milblogger monitoring (250+ channels)",
                "Military aircraft tracking via ADS-B",
                "OSINT event aggregation from GDELT and RSS feeds",
                "AI-generated intelligence briefings",
                "Interactive threat map",
                "Multi-language translation via Claude AI",
              ],
            })}
          />

          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
