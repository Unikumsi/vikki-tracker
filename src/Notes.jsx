import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { subscribePath, setPath, removePath } from './firebase';

const ROOT = 'notes/v1';

function formatWhen(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `сегодня · ${time}`;
  if (isYesterday) return `вчера · ${time}`;
  const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${date} · ${time}`;
}

export default function Notes() {
  const [notes, setNotes] = useState({});
  const [input, setInput] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    const unsub = subscribePath(ROOT, setNotes);
    return () => unsub && unsub();
  }, []);

  const list = Object.entries(notes || {})
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const add = () => {
    const text = input.trim();
    if (!text) return;
    const id = String(Date.now());
    setPath(`${ROOT}/${id}`, { text, createdAt: Date.now() });
    setInput('');
  };

  const del = (id) => {
    removePath(`${ROOT}/${id}`);
    setConfirmDel(null);
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Что записать? Можно что угодно — вес, наблюдения, советы вета…"
          className="w-full text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 focus:outline-none resize-none placeholder:text-slate-400"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={add}
            disabled={!input.trim()}
            className="text-sm bg-slate-800 text-white px-4 py-2 rounded-full font-medium hover:bg-slate-900 disabled:opacity-30 transition active:scale-95"
          >
            Добавить запись
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-6">
            Пока нет записей
          </div>
        )}
        {list.map((n) => (
          <div key={n.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">{n.text}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">{formatWhen(n.createdAt)}</span>
              {confirmDel === n.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => del(n.id)}
                    className="text-xs bg-rose-500 text-white px-3 py-1 rounded-full font-medium"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="text-xs text-slate-500 px-2"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDel(n.id)}
                  className="text-slate-400 hover:text-rose-600 transition"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
