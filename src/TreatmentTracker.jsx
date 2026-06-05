import { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, ChevronRight, Droplets, Eye, Sparkles, Cloud, CloudOff, CalendarDays } from 'lucide-react';
import { subscribeToData, saveDataToCloud } from './firebase';
import Notes from './Notes.jsx';
import Commands from './Commands.jsx';

const PLAN_START = new Date(2026, 5, 4); // 4 июня 2026
const PLAN_DAYS = 30;                    // запас по дням (план — 10 дней)
const VISIBLE_BARS = 10; // сколько мини-полосок показывать сверху

const medications = [
  {
    id: 1,
    name: 'Промывание глаз',
    detail: 'Физ. раствор, от внешнего к внутреннему уголку',
    dosesPerDay: 4,
    startDay: 0,
    durationDays: 10,
    icon: Droplets,
    color: 'sky',
  },
  {
    id: 2,
    name: 'Данцил',
    detail: 'Глазные капли, по 1 капле',
    dosesPerDay: 4,
    startDay: 0,
    durationDays: 10,
    icon: Eye,
    color: 'indigo',
  },
];

const colors = {
  sky:     { soft: 'bg-sky-50',     softer: 'bg-sky-100/60',     text: 'text-sky-700',     border: 'border-sky-200',     solid: 'bg-sky-500',     ring: 'ring-sky-200' },
  indigo:  { soft: 'bg-indigo-50',  softer: 'bg-indigo-100/60',  text: 'text-indigo-700',  border: 'border-indigo-200',  solid: 'bg-indigo-500',  ring: 'ring-indigo-200' },
  amber:   { soft: 'bg-amber-50',   softer: 'bg-amber-100/60',   text: 'text-amber-700',   border: 'border-amber-200',   solid: 'bg-amber-500',   ring: 'ring-amber-200' },
  emerald: { soft: 'bg-emerald-50', softer: 'bg-emerald-100/60', text: 'text-emerald-700', border: 'border-emerald-200', solid: 'bg-emerald-500', ring: 'ring-emerald-200' },
  rose:    { soft: 'bg-rose-50',    softer: 'bg-rose-100/60',    text: 'text-rose-700',    border: 'border-rose-200',    solid: 'bg-rose-500',    ring: 'ring-rose-200' },
  violet:  { soft: 'bg-violet-50',  softer: 'bg-violet-100/60',  text: 'text-violet-700',  border: 'border-violet-200',  solid: 'bg-violet-500',  ring: 'ring-violet-200' },
  teal:    { soft: 'bg-teal-50',    softer: 'bg-teal-100/60',    text: 'text-teal-700',    border: 'border-teal-200',    solid: 'bg-teal-500',    ring: 'ring-teal-200' },
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getTodayIndex() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(PLAN_START);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return Math.max(0, Math.min(diff, PLAN_DAYS - 1));
}

function formatDate(d) {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatWeekday(d) {
  return d.toLocaleDateString('ru-RU', { weekday: 'long' });
}

function isMedActiveOnDay(med, dayIndex) {
  if (dayIndex < med.startDay) return false;

  // Повторение по месяцам
  if (med.recurMonths) {
    const dayDate = addDays(PLAN_START, dayIndex);
    const startDate = addDays(PLAN_START, med.startDay);
    if (dayDate.getDate() !== startDate.getDate()) return false;
    const monthDiff =
      (dayDate.getFullYear() - startDate.getFullYear()) * 12 +
      (dayDate.getMonth() - startDate.getMonth());
    if (monthDiff < 0) return false;
    return monthDiff % med.recurMonths === 0;
  }

  // Повторение каждые N дней
  if (med.recurEveryDays) {
    const cycle = (dayIndex - med.startDay) % med.recurEveryDays;
    return cycle < (med.durationDays || 1);
  }

  // Разовое окно [startDay, startDay+durationDays)
  return dayIndex < med.startDay + (med.durationDays || 1);
}

// Список всех дней, где есть хотя бы одна процедура. Пустые дни пропускаются.
const SCHEDULED_DAYS = (() => {
  const days = [];
  for (let i = 0; i < PLAN_DAYS; i++) {
    if (medications.some((m) => isMedActiveOnDay(m, i))) days.push(i);
  }
  return days;
})();

// Ближайший «рабочий» день на/после reference (или последний, если все позади).
function nearestScheduledDay(reference) {
  if (SCHEDULED_DAYS.length === 0) return 0;
  const next = SCHEDULED_DAYS.find((d) => d >= reference);
  return next !== undefined ? next : SCHEDULED_DAYS[SCHEDULED_DAYS.length - 1];
}

export default function TreatmentTracker() {
  const [data, setData] = useState({});
  const [currentDay, setCurrentDay] = useState(() => nearestScheduledDay(getTodayIndex()));
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState('plan');
  const remoteEcho = useRef(null);

  useEffect(() => {
    const unsub = subscribeToData((cloudData) => {
      setConnected(true);
      remoteEcho.current = JSON.stringify(cloudData);
      setData(cloudData);
    });
    return () => unsub && unsub();
  }, []);

  const saveData = (newData) => {
    setData(newData);
    const serialized = JSON.stringify(newData);
    if (serialized === remoteEcho.current) return;
    remoteEcho.current = serialized;
    saveDataToCloud(newData).catch((e) => {
      console.error('Не удалось сохранить', e);
    });
  };

  const dayKey = String(currentDay);
  const dayData = data[dayKey] || {};

  const toggleDose = (medId, doseIdx) => {
    const newData = { ...data };
    if (!newData[dayKey]) newData[dayKey] = {};
    if (!newData[dayKey][medId]) newData[dayKey][medId] = [];
    const arr = [...newData[dayKey][medId]];
    arr[doseIdx] = !arr[doseIdx];
    newData[dayKey] = { ...newData[dayKey], [medId]: arr };
    saveData(newData);
  };

  const isChecked = (medId, doseIdx) => !!dayData[medId]?.[doseIdx];

  const medCompleted = (med) => {
    const arr = dayData[med.id] || [];
    let n = 0;
    for (let i = 0; i < med.dosesPerDay; i++) if (arr[i]) n++;
    return n;
  };

  const activeMeds = medications.filter((m) => isMedActiveOnDay(m, currentDay));
  const dayTotalDoses = activeMeds.reduce((s, m) => s + m.dosesPerDay, 0);
  const dayCompleted = activeMeds.reduce((s, m) => s + medCompleted(m), 0);
  const dayPercent = dayTotalDoses === 0 ? 0 : Math.round((dayCompleted / dayTotalDoses) * 100);
  const dayFullyDone = dayTotalDoses > 0 && dayCompleted === dayTotalDoses;

  const dayDate = addDays(PLAN_START, currentDay);
  const todayIdx = getTodayIndex();
  const effectiveTodayIdx = nearestScheduledDay(todayIdx);
  const isToday = currentDay === todayIdx;
  const currentScheduledIdx = SCHEDULED_DAYS.indexOf(currentDay);
  const isFirstScheduled = currentScheduledIdx <= 0;
  const isLastScheduled = currentScheduledIdx >= SCHEDULED_DAYS.length - 1;
  const goToPrev = () => {
    if (currentScheduledIdx > 0) setCurrentDay(SCHEDULED_DAYS[currentScheduledIdx - 1]);
  };
  const goToNext = () => {
    if (currentScheduledIdx >= 0 && currentScheduledIdx < SCHEDULED_DAYS.length - 1) {
      setCurrentDay(SCHEDULED_DAYS[currentScheduledIdx + 1]);
    }
  };

  // Прокручиваемое окно мини-полосок: VISIBLE_BARS «рабочих» дней вокруг currentDay
  const windowStart = Math.max(
    0,
    Math.min(
      Math.max(0, SCHEDULED_DAYS.length - VISIBLE_BARS),
      currentScheduledIdx - Math.floor(VISIBLE_BARS / 2)
    )
  );
  const visibleDays = SCHEDULED_DAYS.slice(windowStart, windowStart + VISIBLE_BARS);

  const progressForDay = (i) => {
    const dd = data[String(i)] || {};
    const active = medications.filter((m) => isMedActiveOnDay(m, i));
    if (active.length === 0) return 0;
    let total = 0, done = 0;
    active.forEach((m) => {
      total += m.dosesPerDay;
      const arr = dd[m.id] || [];
      for (let j = 0; j < m.dosesPerDay; j++) if (arr[j]) done++;
    });
    return total === 0 ? 0 : done / total;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-white pb-12">
      <div className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
              🐶 Викки
            </h1>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              {connected ? (
                <><Cloud className="w-3 h-3 text-emerald-500" /> синхр.</>
              ) : (
                <><CloudOff className="w-3 h-3" /> офлайн</>
              )}
            </span>
          </div>

          <div className="mt-3 flex gap-0.5 bg-slate-100 p-1 rounded-full overflow-x-auto">
            {[
              { key: 'plan',     label: 'План' },
              { key: 'notes',    label: 'Заметки' },
              { key: 'commands', label: 'Команды' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-full transition whitespace-nowrap ${
                  tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'plan' && (
            <div className="mt-3 flex gap-1">
              {visibleDays.map((i) => {
                const p = progressForDay(i);
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentDay(i)}
                    className={`flex-1 h-1.5 rounded-full overflow-hidden transition ${
                      i === currentDay ? 'ring-2 ring-slate-400 ring-offset-1' : ''
                    }`}
                    aria-label={`День ${i + 1}`}
                  >
                    <div className="w-full h-full bg-slate-200 relative">
                      <div
                        className={`h-full transition-all ${p === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        style={{ width: `${p * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {tab === 'notes' && <Notes />}
      {tab === 'commands' && <Commands />}

      {tab === 'plan' && <div className="max-w-md mx-auto px-4">
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrev}
              disabled={isFirstScheduled}
              className="w-10 h-10 rounded-full bg-slate-100 disabled:opacity-30 hover:bg-slate-200 active:scale-95 transition flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>

            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                День {currentDay + 1}
                {isToday && <span className="ml-1.5 text-emerald-600">• сегодня</span>}
              </div>
              <div className="text-lg font-semibold text-slate-800 leading-tight mt-0.5">
                {formatDate(dayDate)}
              </div>
              <div className="text-xs text-slate-500 capitalize">{formatWeekday(dayDate)}</div>
            </div>

            <button
              onClick={goToNext}
              disabled={isLastScheduled}
              className="w-10 h-10 rounded-full bg-slate-100 disabled:opacity-30 hover:bg-slate-200 active:scale-95 transition flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {currentDay !== effectiveTodayIdx && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setCurrentDay(effectiveTodayIdx)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-slate-50 hover:bg-slate-100 rounded-full px-3 py-1 transition"
              >
                <CalendarDays className="w-3 h-3" />
                {effectiveTodayIdx === todayIdx ? 'Перейти к сегодня' : 'К ближайшему дню'}
              </button>
            </div>
          )}

          {dayTotalDoses > 0 ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500">Прогресс дня</span>
                <span className="font-semibold text-slate-700">
                  {dayCompleted} / {dayTotalDoses}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    dayFullyDone
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      : 'bg-gradient-to-r from-slate-400 to-slate-500'
                  }`}
                  style={{ width: `${dayPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center text-xs text-slate-400">
              На этот день процедур не запланировано
            </div>
          )}

          {dayFullyDone && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-emerald-600 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Все процедуры на сегодня выполнены
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {activeMeds.map((med, idx) => {
            const c = colors[med.color];
            const Icon = med.icon;
            const done = medCompleted(med);
            const allDone = done === med.dosesPerDay;

            return (
              <div
                key={med.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  allDone ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${c.soft} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 leading-tight">
                          <span className="text-slate-400 mr-1">{idx + 1}.</span>
                          {med.name}
                        </h3>
                        {allDone && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">{med.detail}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {med.dosesPerDay}× в день
                        {med.note && ` • ${med.note}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3.5">
                    {Array.from({ length: med.dosesPerDay }).map((_, i) => {
                      const checked = isChecked(med.id, i);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleDose(med.id, i)}
                          className={`flex-1 h-12 rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center font-semibold text-sm ${
                            checked
                              ? `${c.solid} border-transparent text-white shadow-sm`
                              : `bg-white ${c.border} ${c.text}`
                          }`}
                          aria-label={`Доза ${i + 1}`}
                        >
                          {checked ? <Check className="w-5 h-5" strokeWidth={3} /> : i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>}
    </div>
  );
}
