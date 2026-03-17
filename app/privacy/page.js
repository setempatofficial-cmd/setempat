// app/privacy/page.js
export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 font-sans text-slate-800">
      <h1 className="text-3xl font-black mb-8 text-[#E3655B]">Kebijakan Privasi Setempat.id</h1>
      
      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-bold mb-2">1. Informasi yang Kami Kumpulkan</h2>
          <p>
            Kami mengumpulkan informasi yang Anda berikan saat masuk menggunakan Google, 
            seperti nama, alamat email, dan foto profil untuk keperluan identitas akun di platform kami.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2">2. Penggunaan Data</h2>
          <p>
            Data Anda digunakan semata-mata untuk personalisasi layanan di Setempat.id, 
            termasuk fitur laporan warga dan interaksi di dalam portal lokal kami. 
            Kami tidak menjual data Anda kepada pihak ketiga.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2">3. Keamanan Data</h2>
          <p>
            Kami menggunakan layanan infrastruktur keamanan dari Supabase dan Google 
            untuk memastikan data Anda terlindungi dengan standar enkripsi industri.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2">4. Kontak Kami</h2>
          <p>
            Jika ada pertanyaan mengenai privasi ini, Anda bisa menghubungi kami melalui 
            email resmi di halo@setempat.id.
          </p>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        Terakhir diperbarui: Maret 2026 • Pasuruan, Jawa Timur
      </footer>
    </div>
  );
}