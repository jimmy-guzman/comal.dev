import "./globals.css";

import type { Metadata } from "next";

import { JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { AnonymousSession } from "@/components/anonymous-session";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  description: "AI chat and agent starter.",
  icons: { icon: "/mascot.svg" },
  title: "comal.dev",
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
        <AnonymousSession />
        <NuqsAdapter>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
