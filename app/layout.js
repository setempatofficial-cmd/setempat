// app/layout.js
import Head from 'next/head'

export const metadata = {
  title: "Setempat.id — Melihat Kehidupan Sekitar",
  description: "Platform yang menampilkan apa yang sedang terjadi di sekitarmu secara real-time—dari suasana, aktivitas, hingga laporan warga. Bukan sekadar tempat, tapi kehidupan yang sedang berlangsung.",
  icons: {
    icon: "/favicon.ico", // Sesuaikan dengan nama file yang tadi kamu pindah ke folder app
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        {/* Ini cadangan agar ikon benar-benar muncul */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}