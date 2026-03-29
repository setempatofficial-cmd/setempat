// app/layout.js
import { LocationProvider } from "@/components/LocationProvider";
import { ThemeProvider } from "@/app/hooks/useTheme"; // Jika ada

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {/* Bungkus CHILDREN agar semua halaman punya akses lokasi & tema */}
        <LocationProvider>
          {children}
        </LocationProvider>
      </body>
    </html>
  );
}