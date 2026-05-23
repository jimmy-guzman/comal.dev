import "./globals.css";

import type { Metadata, Viewport } from "next";

import { JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const SITE_URL = "https://comal.dev";
const SITE_DESCRIPTION =
  "Open source playground for composing your own AI agents from a shared toolbox.";

export const metadata: Metadata = {
  applicationName: "comal.dev",
  authors: [{ name: "Jimmy Guzman", url: "https://jimmy.codes" }],
  category: "technology",
  creator: "Jimmy Guzman",
  description: SITE_DESCRIPTION,
  icons: { icon: "/mascot.svg" },
  keywords: [
    "open source",
    "developer tools",
    "ai agents",
    "ai sdk",
    "next.js",
    "playground",
    "comal.dev",
  ],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: "en_US",
    siteName: "comal.dev",
    title: "comal.dev",
    type: "website",
    url: SITE_URL,
  },
  publisher: "Jimmy Guzman",
  title: "comal.dev",
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
    title: "comal.dev",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  applicationCategory: "DeveloperApplication",
  author: { "@type": "Person", name: "Jimmy Guzman", url: "https://jimmy.codes" },
  description: SITE_DESCRIPTION,
  isAccessibleForFree: true,
  name: "comal.dev",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  operatingSystem: "Web",
  url: SITE_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn("dark", "h-svh", "antialiased", "font-mono", jetbrainsMono.variable)}
      lang="en"
    >
      <body className="flex h-full min-h-0 flex-col">
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <NuqsAdapter>
          <TooltipProvider>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </TooltipProvider>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
