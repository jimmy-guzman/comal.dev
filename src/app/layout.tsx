import "./globals.css";

import type { Metadata, Viewport } from "next";

import { JetBrains_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
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
        <TooltipProvider>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
