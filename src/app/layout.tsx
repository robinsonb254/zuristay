import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://zuristayworldwide.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hotels & Places to Stay in Kenya | ZuriStay Worldwide",
    template: "%s | ZuriStay Worldwide",
  },
  description:
    "Discover hotels, resorts, apartments, villas, lodges and guesthouses across Kenya. Explore Nairobi, Mombasa, Diani, Malindi and destinations nationwide with ZuriStay Worldwide.",
  applicationName: "ZuriStay Worldwide",
  category: "travel",
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  keywords: [
    "ZuriStay Worldwide",
    "ZuriStay",
    "hotels in Kenya",
    "hotel booking Kenya",
    "accommodation in Kenya",
    "places to stay in Kenya",
    "hotels in Nairobi",
    "hotels in Mombasa",
    "Diani Beach accommodation",
    "Malindi hotels",
    "Kenya holiday apartments",
    "villas in Kenya",
    "Kenya resorts",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ZuriStay Worldwide",
    title: "Hotels & Places to Stay in Kenya | ZuriStay Worldwide",
    description:
      "Find hotels, apartments, villas, resorts and guesthouses across Kenya with ZuriStay Worldwide.",
    locale: "en_KE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hotels & Places to Stay in Kenya | ZuriStay Worldwide",
    description:
      "Discover accommodation across Kenya, from city hotels to coastal escapes and safari stays.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "ZuriStay Worldwide",
      url: siteUrl,
      logo: `${siteUrl}/brand/zuristay-light.svg`,
      areaServed: {
        "@type": "Country",
        name: "Kenya",
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "ZuriStay Worldwide",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: ["en-KE"],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-KE">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
