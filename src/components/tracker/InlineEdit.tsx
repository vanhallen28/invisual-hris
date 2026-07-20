'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function InlineEdit({ value, onSave, className = '', textClassName = '', placeholder = 'Fill...', style = {}, isLink = false, onEnter }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);
  // Penjaga agar penyimpanan hanya sekali. Menekan Enter menutup input,
  // yang otomatis memicu onBlur — tanpa penjaga ini, onSave terkirim dua kali.
  const sudahSimpan = useRef(false);

  useEffect(() => { setVal(value); }, [value]);

  const handleSave = () => {
    if (sudahSimpan.current) return;
    sudahSimpan.current = true;
    setIsEditing(false);
    if (val !== value) onSave(val);
  };

  const mulaiEdit = () => { sudahSimpan.current = false; setIsEditing(true); };

  if (isEditing) {
    return (
      <div className="flex-1 min-w-0 w-full relative flex items-center justify-center overflow-hidden">
        <input 
          autoFocus autoComplete="off" spellCheck="false" 
          value={val} onChange={(e) => setVal(e.target.value)} 
          onBlur={handleSave} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter hanya menyimpan dan menutup. Baris baru dibuat lewat
              // tombol "+", bukan sebagai efek samping saat mengganti nama.
              e.preventDefault();
              const tambahBaris = e.shiftKey && onEnter;   // Shift+Enter = pengetikan cepat
              handleSave();
              if (tambahBaris) onEnter();
            }
            if (e.key === 'Escape') { sudahSimpan.current = true; setVal(value); setIsEditing(false); }
          }} 
          onClick={(e) => e.stopPropagation()} 
          className={`bg-zinc-950 border border-blue-500 rounded px-1.5 py-0.5 outline-none text-white shadow-inner w-full min-w-0 box-border truncate ${className}`} 
          style={style} 
        />
      </div>
    );
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); mulaiEdit(); }} className={`w-full h-full min-w-0 flex items-center justify-center cursor-text px-1 ${textClassName}`} style={style}>
       {isLink && val ? (
          <a href={String(val).startsWith('http') ? String(val) : `https://${val}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="truncate block max-w-full text-blue-400 hover:underline hover:text-blue-300 transition-colors relative z-20">{val}</a>
       ) : (
          <span className={`truncate block max-w-full w-full min-h-[16px] ${!val ? 'text-zinc-500 italic font-normal' : ''}`}>{val || placeholder}</span>
       )}
    </div>
  );
}
