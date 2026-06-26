// src/components/layout/Footer.tsx
export default function Footer() {
  return (
    <footer className="bg-[#2b5cd5] text-white py-12 px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        
        {/* Kolom Kiri: Slogan */}
        <div className="md:w-1/2">
          <h2 className="text-4xl font-bold leading-tight max-w-md">
            We help brands look good, feel relevant, and be recognizable.
          </h2>
        </div>

        {/* Kolom Kanan: Kontak & Alamat */}
        <div className="flex gap-16 mt-8 md:mt-0">
          <div>
            <h3 className="font-bold mb-3 text-lg">Business</h3>
            <p className="text-sm text-blue-100 mb-2">business@invisual.studio</p>
            <p className="text-sm text-blue-100">+62 822 9555 5314</p>
          </div>
          <div>
            <h3 className="font-bold mb-3 text-lg">Head Office</h3>
            <p className="text-sm text-blue-100 leading-relaxed">
              Jl. Golf Bar. XVII No.8,<br />
              Sukamiskin, Kec. Arcamanik,<br />
              Kota Bandung, Jawa Barat 40293
            </p>
          </div>
        </div>
      </div>

      {/* Bagian Bawah: Copyright & Sosial Media */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-blue-400/50 flex justify-between items-center text-sm text-blue-100">
        <p>© Invisual Studio 2026 - All Rights Reserved</p>
        <div className="flex gap-6 font-medium">
          <a href="#" className="hover:text-white transition-colors">Behance</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          <a href="#" className="hover:text-white transition-colors">Instagram</a>
        </div>
      </div>
    </footer>
  );
}