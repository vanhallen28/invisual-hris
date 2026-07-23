// src/app/user/loading.tsx

export default function UserLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-latar min-h-screen animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        {/* Efek Cahaya (Glow) Halus di Belakang Logo */}
        <div className="absolute inset-0 bg-primer-terang/20 rounded-full blur-2xl animate-pulse"></div>
        
        {/* LOGO INVISUAL BERPUTAR PELAN (3 detik) */}
        <img 
          src="/logo.png" 
          alt="Memuat Invisual..." 
          className="relative w-16 h-16 animate-spin object-contain" 
          style={{ animationDuration: "3s" }} 
        />
      </div>
      
      {/* TEKS LOADING */}
      <p className="text-gray-500 text-[10px] md:text-xs font-mono tracking-[0.25em] uppercase mt-8 animate-pulse">
        Menyiapkan Ruang Kerja...
      </p>
    </div>
  );
}