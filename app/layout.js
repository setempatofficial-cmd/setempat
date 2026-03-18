

export const metadata = {
  title: "Setempat.id — Melihat Kehidupan Sekitar",
  description: "Platform yang menampilkan apa yang sedang terjadi di sekitarmu secara real-time—dari suasana, aktivitas, hingga laporan warga. Bukan sekadar tempat, tapi kehidupan yang sedang berlangsung.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}