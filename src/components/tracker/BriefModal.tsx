'use client';

import { useState } from 'react';
import { supabase } from '../../../../utils/supabase';
import { X } from 'lucide-react';

interface BriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BriefModal({ isOpen, onClose, onSuccess }: BriefModalProps) {
  const [projectName, setProjectName] = useState('');
  const [assignee, setAssignee] = useState('');
  const [briefType, setBriefType] = useState('Branding Visual');
  const [dueDate, setDueDate] = useState('');
  const [briefDocLink, setBriefDocLink] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('daily_briefs').insert([
      {
        project_name: projectName,
        assignee,
        brief_type: briefType,
        status: 'Not Started',
        due_date: dueDate || null,
        brief_doc_link: briefDocLink || null,
      },
    ]);

    setLoading(false);
    if (!error) {
      setProjectName('');
      setAssignee('');
      setDueDate('');
      setBriefDocLink('');
      onSuccess();
      onClose();
    } else {
      alert('Gagal menambahkan brief: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg p-7 relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-semibold text-zinc-100 mb-6 tracking-wide">Create New Task</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Task Name</label>
            <input type="text" required value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-600 text-zinc-200 text-sm transition-colors" placeholder="e.g. Twister Plot Font Production" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Assignee</label>
            <input type="text" required value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-600 text-zinc-200 text-sm transition-colors" placeholder="e.g. Dea / Jo / Aul" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Category</label>
            <select value={briefType} onChange={(e) => setBriefType(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-600 text-zinc-200 text-sm transition-colors appearance-none">
              <option value="Branding Visual">Branding Visual</option>
              <option value="Font Production">Font Production</option>
              <option value="Marketplace Asset">Marketplace Asset</option>
              <option value="Performance Marketing">Performance Marketing</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-600 text-zinc-200 text-sm transition-colors [color-scheme:dark]" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Document Link</label>
            <input type="url" value={briefDocLink} onChange={(e) => setBriefDocLink(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-600 text-zinc-200 text-sm transition-colors" placeholder="https://..." />
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-semibold text-zinc-900 bg-zinc-100 hover:bg-white rounded-md disabled:bg-zinc-600 transition-colors">
              {loading ? 'Saving...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}