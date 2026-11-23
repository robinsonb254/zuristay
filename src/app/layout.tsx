import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZuriStay Worldwide | Find Your Stay. Feel at Home.",
  description:
    "Discover and book hotels, resorts, apartments, villas and unique stays across Kenya and beyond with ZuriStay Worldwide.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  keywords: [
    "ZuriStay Worldwide",
    "ZuriStay",
    "Kenya hotels",
    "hotel booking",
    "apartments",
    "holiday stays",
    "accommodation",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
