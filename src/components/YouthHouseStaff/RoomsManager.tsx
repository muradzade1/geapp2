import { type FormEvent, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string | null;
}

export function RoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState({ name: '', capacity: '', description: '' });

  const load = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('youth_house_rooms').select('id, name, capacity, description').order('name');
    if (fetchError) setError('Otaqları yükləmək mümkün olmadı.');
    else setRooms((data ?? []) as Room[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setValues({ name: '', capacity: '', description: '' });
    setFormOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing(room);
    setValues({ name: room.name, capacity: String(room.capacity), description: room.description ?? '' });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const capacity = Number(values.capacity);
    if (!values.name.trim() || Number.isNaN(capacity) || capacity < 0) {
      setError('Otaq adı və düzgün tutum daxil edin.');
      setSaving(false);
      return;
    }
    const payload = { name: values.name.trim(), capacity, description: values.description.trim() || null };
    if (editing) {
      const { error: updateError } = await supabase.from('youth_house_rooms').update(payload).eq('id', editing.id);
      if (updateError) setError('Yadda saxlamaq mümkün olmadı.');
      else { await load(); setFormOpen(false); }
    } else {
      const { error: insertError } = await supabase.from('youth_house_rooms').insert(payload);
      if (insertError) setError('Yadda saxlamaq mümkün olmadı.');
      else { await load(); setFormOpen(false); }
    }
    setSaving(false);
  };

  const remove = async (room: Room) => {
    if (!confirm(`"${room.name}" otağını silmək istədiyinizə əminsiniz?`)) return;
    const { error: deleteError } = await supabase.from('youth_house_rooms').delete().eq('id', room.id);
    if (deleteError) setError('Silmək mümkün olmadı.');
    else await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Otaqlar</h3>
          <p className="text-sm text-gray-500">{rooms.length} qeyd</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Plus className="h-4 w-4" />Yeni otaq
        </button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-6 py-14 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Yüklənir...</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-500">Hələ otaq əlavə edilməyib. "Yeni otaq" düyməsindən əlavə edin.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div key={room.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-900">{room.name}</p>
                  <p className="text-xs text-gray-500">Tutum: {room.capacity}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(room)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void remove(room)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {room.description && <p className="mt-2 text-sm text-gray-600">{room.description}</p>}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">{editing ? 'Otağı redaktə et' : 'Yeni otaq'}</h4>
              <button onClick={() => setFormOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Otaq adı</span><input required value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Tutum</span><input required type="number" min={0} value={values.capacity} onChange={(event) => setValues((current) => ({ ...current, capacity: event.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Qeyd</span><textarea rows={3} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ləğv et</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Yadda saxla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
