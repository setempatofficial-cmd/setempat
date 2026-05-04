import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider } from "@/app/context/AuthContext";
import LocationProvider from "@/components/LocationProvider";
import AdminActionSheet from "./components/AdminActionSheet"; // 👈 Import di sini

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <LocationProvider> 
            <DataProvider>
              
              {children}
              
              {/* 
                Taruh di sini agar bisa mengakses context jika nanti 
                admin action sheet butuh data user/lokasi 
              */}
              <AdminActionSheet />

            </DataProvider>
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}