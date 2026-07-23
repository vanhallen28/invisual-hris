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
    <div className={`min-h-screen w-full bg-kartu text-gray-100 font-sans transition-[padding] duration-300 ease-out ${detailItem ? 'sm:pr-[480px]' : ''}`}>
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 bg-kartu-hover sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image src="/invisual-light.svg" alt="Invisual" width={120} height={26} className="brightness-0 invert opacity-90 shrink-0" />
          <span className="text-gray-500 font-medium text-sm border-l border-white/10 pl-2.5 hidden sm:inline">My Tasks</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primer-terang flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{initials}</div>
            <span className="text-sm text-gray-300 hidden sm:block">{name}</span>
          </div>
          <button onClick={doLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-kartu-hover hover:bg-kartu-hover px-3 py-1.5 rounded-lg transition-colors"><LogOut size={13} /> Keluar</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <MyTasks />
      </div>

      <ItemDetailPanel push />
    </div>
  );
}
