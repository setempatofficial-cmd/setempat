// app/layout.jsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider } from "@/app/context/AuthContext";
import LocationProvider from "@/components/LocationProvider";
import AdminActionSheetWrapper from "./components/AdminActionSheetWrapper";
import Script from "next/script";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary"; // ← TAMBAHKAN
import { ChunkErrorHandler } from "@/components/ChunkErrorHandler"; // ← TAMBAHKAN

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ METADATA (LENGKAP dengan favicon)
export const metadata: Metadata = {
  title: "SetempatID - Melihat Kehidupan Sekitar",
  description: "Aplikasi untuk menampilkan kondisi terkini di lingkungan sekitar secara real-time",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "72x72", type: "image/x-icon" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SetempatID",
  },
};

// ✅ VIEWPORT
export const viewport: Viewport = {
  themeColor: "#06b6d4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        {/* Meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SetempatID" />

        {/* Favicon untuk tab browser */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ Chunk Error Handler - Auto recovery */}
        <ChunkErrorHandler />

        {/* ✅ Error Boundary untuk seluruh aplikasi */}
        <ChunkErrorBoundary>
          <AuthProvider>
            <LocationProvider>
              <DataProvider>
                {children}
                <AdminActionSheetWrapper />
              </DataProvider>
            </LocationProvider>
          </AuthProvider>
        </ChunkErrorBoundary>

        {/* ✅ Midtrans Snap Script */}
        <Script
          src="https://app.midtrans.com/snap/snap.js"
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="afterInteractive"
        />

        {/* Service Worker Registration */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
    if ('serviceWorker' in navigator && '${process.env.NODE_ENV}' === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg))
        .catch(err => console.log('SW registration failed:', err));
    }
  `}
        </Script>
      </body>
    </html>
  );
}