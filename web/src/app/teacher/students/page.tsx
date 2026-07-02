'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface StudentRow {
  id: string;
  username: string;
  displayName: string;
  pin?: string;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [visiblePins, setVisiblePins] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/students');
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStudents((prev) => [...prev, { id: data.id, username: data.username, displayName: newName.trim() }]);
        setVisiblePins((prev) => ({ ...prev, [data.id]: data.pin }));
        setNewName('');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/students/${id}`, { method: 'DELETE' });
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setVisiblePins((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  async function handleResetPin(id: string) {
    const res = await fetch(`/api/students/${id}/reset-pin`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setVisiblePins((prev) => ({ ...prev, [id]: data.pin }));
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Students</h1>
          <Link href="/teacher" className="text-sm text-slate-400 hover:text-white">← Dashboard</Link>
        </div>

        {/* Add student form */}
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            placeholder="Display name (e.g. Alice Smith)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {adding ? 'Adding…' : '+ Add Student'}
          </button>
        </form>

        {/* Students table */}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : students.length === 0 ? (
          <p className="text-slate-500 text-sm">No students yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Display name</th>
                  <th className="px-4 py-3 text-left font-medium">Username</th>
                  <th className="px-4 py-3 text-left font-medium">PIN</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium">{s.displayName}</td>
                    <td className="px-4 py-3 text-slate-400">@{s.username}</td>
                    <td className="px-4 py-3">
                      {visiblePins[s.id] ? (
                        <span className="font-mono text-green-400 select-all">{visiblePins[s.id]}</span>
                      ) : (
                        <span className="text-slate-600">——</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleResetPin(s.id)}
                        className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                      >
                        Reset PIN
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-800 rounded-lg text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
