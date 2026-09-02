import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { OfflineBanner } from "@/components/locinsight/offline-banner";
import { AuthProvider } from "@/lib/auth-provider";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LocInsights — Location Intelligence for Retail Expansion",
  description:
    "LocInsights — SaaS location intelligence platform for retail store expansion. Identifies optimal store opportunities using composite ML scoring, competitor intel, and GBR revenue prediction. Multi-tenant architecture with role-based access control.",
  keywords: [
    "LocInsights",
    "Location Intelligence",
    "Retail Site Selection",
    "Geomarketing",
    "Huff Model",
    "Gradient Boosting",
    "Multi-tenant SaaS",
    "Expansion Strategy",
  ],
  authors: [{ name: "Achmad Bayhaqy" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "LocInsights",
    statusBarStyle: "black-translucent",
  },
  applicationName: "LocInsights",
  openGraph: {
    title: "LocInsights — Location Intelligence",
    description: "SaaS location intelligence platform for retail expansion",
    siteName: "LocInsights",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7A0A1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // PWA full-screen on Android Chrome + iOS Safari standalone mode
  // (combined with `display: fullscreen` in manifest.json, this hides the
  // browser URL bar and status bar when the app is installed to home screen).
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <LanguageProvider>
            {children}
            <Toaster />
            <SonnerToaster position="top-right" richColors closeButton />
            {/* Offline banner — shows full-screen message when no internet connection */}
            <OfflineBanner />
          </LanguageProvider>
        </AuthProvider>
        {/* Vercel Analytics */}
        <Analytics />
        {/* PWA service worker — registers after page load, defers to avoid blocking */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(e) {
                  console.warn('SW registration failed:', e);
                });
              });
            }`,
          }}
        />
      </body>
    </html>
  );
}
