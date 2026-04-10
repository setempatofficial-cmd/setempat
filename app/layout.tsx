import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider } from "@/app/context/AuthContext"; // 👈 TAMBAHKAN IMPORT

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SetempatID - Melihat Kehidupan Sekitar",
  description: "Aplikasi untuk menampilkan kondisi terkini di lingkungan sekitar secara real-time",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>  {/* 👈 TAMBAHKAN AUTH PROVIDER (DI LUAR ATAU DALAM DataProvider?) */}
          <DataProvider>
            {children}
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}