// app/layout.js
export const metadata = {
  title: "Setempat.id — Melihat Kehidupan Sekitar",
  description: "Platform yang menampilkan apa yang sedang terjadi di sekitarmu secara real-time...",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      {/* JANGAN masukkan tag <head> atau <title> manual di sini */}
      <body>
        {children}
      </body>
    </html>
  );
}