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
  title: "Comal",
  description:
    "An OpenAPI studio. Chat your way to a spec, play with it in a live mock, eject to real code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", "h-full", "antialiased", "font-mono", jetbrainsMono.variable)}
    >
      <body className="flex min-h-full flex-col">
        <AnonymousSession />
        <NuqsAdapter>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
