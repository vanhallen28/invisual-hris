'use client';
import React from 'react';
import Image from 'next/image';
import { useDashboard } from '@/components/tracker/DashboardContext';
import MyTasks from './MyTasks';
import ItemDetailPanel from './ItemDetailPanel';
import { LogOut } from 'lucide-react';

// Tampilan khusus karyawan (role = member): hanya My Tasks miliknya.
// Bisa buka detail tugas & ubah status (RLS mengizinkan update item_values miliknya).
export default function MemberView() {
  const { authUser, doLogout, teamMembers, currentUserId, detailItem }: any = useDashboard();
  const me = (teamMembers || []).find((m: any) => m.id === currentUserId);
  const name = me?.name || authUser?.email || 'Karyawan';
  const initials = me?.initials || (name ? name.slice(0, 2).toUpperCase() : '?');

  return (
    <div className={`min-h-screen w-full bg-[#181b24] text-zinc-100 font-sans transition-[padding] duration-300 ease-out ${detailItem ? 'sm:pr-[480px]' : ''}`}>
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800 bg-[#1e202a] sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image src="/invisual-light.svg" alt="Invisual" width={120} height={26} className="brightness-0 invert opacity-90 shrink-0" />
          <span className="text-zinc-500 font-medium text-sm border-l border-zinc-700 pl-2.5 hidden sm:inline">My Tasks</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#579bfc] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{initials}</div>
            <span className="text-sm text-zinc-300 hidden sm:block">{name}</span>
          </div>
          <button onClick={doLogout} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"><LogOut size={13} /> Keluar</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <MyTasks />
      </div>

      <ItemDetailPanel push />
    </div>
  );
}
