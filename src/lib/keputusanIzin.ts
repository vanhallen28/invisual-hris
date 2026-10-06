// src/lib/keputusanIzin.ts
//
// Setujui / tolak pengajuan cuti/izin/WFH dari Kalender Cuti & Izin (halaman
// Kehadiran). Efeknya SAMA dengan tombol di Dashboard admin untuk jenis selain
// "Izin Terlambat": ubah status → beri tahu karyawan (push) → catat audit log.
// (Izin Terlambat tidak tampil di kalender, jadi tak perlu keputusan jam pulang.)
import { logAudit } from "@/lib/audit";
import { pushNotify } from "@/lib/push";

type SB = any;

export async function putuskanPengajuan(supabase: SB, req: any, action: "Disetujui" | "Ditolak"): Promise<void> {
  const { error } = await supabase.from("approvals").update({ status: action }).eq("id", req.id);
  if (error) throw new Error(error.message);
  try {
    if (req?.idKaryawan) {
      const { data: emp } = await supabase.from("employees").select("user_id").eq("idKaryawan", req.idKaryawan).maybeSingle();
      if (emp?.user_id) {
        pushNotify(supabase, {
          memberIds: [emp.user_id],
          title: `Pengajuan ${req.jenis}: ${action}`,
          body: action === "Disetujui" ? "Pengajuan Anda telah disetujui." : "Pengajuan Anda ditolak.",
          url: "/user/kehadiran",
          tag: "pengajuan",
        });
      }
    }
  } catch { /* notifikasi gagal tak boleh membatalkan keputusan */ }
  logAudit(action === "Disetujui" ? "Setujui Cuti/Izin" : "Tolak Cuti/Izin", `Pengajuan #${req.id}`, "via Kalender Cuti & Izin");
}
