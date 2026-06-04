import { useState, useEffect } from 'react';
import { Trash2, GraduationCap, CheckCircle2, Circle } from 'lucide-react';
import { subscribePath, setPath, removePath } from './firebase';

const ROOT = 'commands/v1';

// Уровни освоения
const LEVELS = [
  { key: 'learning', label: 'Учим', dotClass: 'bg-amber-400' },
  { key: 'knows',    label: 'Знает',  dotClass: 'bg-emerald-500' },
];

export default function Commands() {
  const [items, setItems] = useState({});
  const [input, setInput] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    const unsub = subscribePath(ROOT, setItems);
    return () => unsub && unsub();
  }, []);

  const list = Object.entries(items || {})
    .map(([id, c]) => ({ id, level: 'learning', ...c }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const add = () => {
    const name = input.trim();
    if (!name) return;
    const id = String(Date.now());
    setPath(`${ROOT}/${id}`, { name, level: 'learning', createdAt: Date.now() });
    setInput('');
  };

  const cycleLevel = (item) => {
    const idx = LEVELS.findIndex((l) => l.key === item.level);
    const next = LEVELS[(idx + 1) % LEVELS.length];
    setPath(`${ROOT}/${item.id}`, { ...item, level: next.key });
  };

  const del = (id) => {
    removePath(`${ROOT}/${id}`);
    setConfirmDel(null);
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Сидеть, лапа, ко мне…"
            className="flex-1 text-sm py-2 bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded-full font-medium hover:bg-slate-900 disabled:opacity-30 transition active:scale-95"
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-6">
            Пока ни одной команды. Добавьте первую — например «сидеть».
          </div>
        )}
        {list.map((c) => {
          const level = LEVELS.find((l) => l.key === c.level) || LEVELS[0];
          const knows = c.level === 'knows';
          return (
            <div
              key={c.id}
              className={`bg-white rounded-2xl border shadow-sm p-3.5 flex items-center gap-3 transition ${
                knows ? 'border-emerald-200' : 'border-slate-200'
              }`}
            >
              <button
                onClick={() => cycleLevel(c)}
                className="flex-shrink-0 active:scale-90 transition"
                aria-label="Изменить статус"
              >
                {knows ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <Circle className="w-6 h-6 text-amber-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 capitalize leading-tight">{c.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${level.dotClass}`} />
                  <span className="text-[11px] text-slate-500">{level.label}</span>
                </div>
              </div>
              {confirmDel === c.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => del(c.id)}
                    className="text-xs bg-rose-500 text-white px-2.5 py-1 rounded-full font-medium"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="text-xs text-slate-500 px-1.5"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDel(c.id)}
                  className="text-slate-400 hover:text-rose-600 transition flex-shrink-0"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-slate-400 text-center">
        Нажмите на кружок слева, чтобы переключить «Учим» ↔ «Знает»
      </p>
    </div>
  );
}
