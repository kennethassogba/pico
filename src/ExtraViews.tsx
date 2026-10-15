import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Content } from './schema';
import { numericValue } from './Graphics';

type Props = { content?: Partial<Content>; items: Content['items']; busy: boolean; onChange: (content: Content) => void };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime()) ? new Date(`${value}T12:00:00`) : null;

export function CalendarView({ items }: Props) {
  const firstDate = items.map(item => parseDate(item.value)).find(Boolean);
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const current = month || firstDate || new Date();
  const year = current.getFullYear(), index = current.getMonth();
  const start = (new Date(year, index, 1).getDay() + 6) % 7;
  const days = new Date(year, index + 1, 0).getDate();
  const monthKey = dateKey(new Date(year, index, 1)).slice(0, 7);
  const listed = items.filter(item => selected ? item.value === selected : item.value.startsWith(monthKey));
  const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return <div className="calendar-view">
    <div className="calendar-sheet">
      <div className="calendar-heading"><h3>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(current)}</h3><div><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => { setMonth(new Date(year, index - 1, 1)); setSelected(null); }}><ChevronLeft /></Button><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => { setMonth(new Date(year, index + 1, 1)); setSelected(null); }}><ChevronRight /></Button></div></div>
      <div className="calendar-days">{Array.from({ length: 7 }, (_, i) => <span className="weekday" key={i}>{dayFormat.format(new Date(2026, 5, 1 + i))}</span>)}
        {Array.from({ length: start }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => { const date = dateKey(new Date(year, index, i + 1)), count = items.filter(item => item.value === date).length; return <button key={date} type="button" aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(year, index, i + 1))}${count ? `, ${count} events` : ''}`} aria-pressed={selected === date} className={date === dateKey(new Date()) ? 'is-today' : ''} onClick={() => setSelected(selected === date ? null : date)}>{i + 1}{count > 0 && <i aria-hidden="true" />}</button>; })}
      </div>
    </div>
    <div className="calendar-events" aria-live="polite">{listed.length ? listed.map((item, i) => <div key={i}><time dateTime={item.value}>{parseDate(item.value) ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(parseDate(item.value)!) : item.value}</time><div><strong>{item.name}</strong><p>{item.detail}</p></div></div>) : <p className="view-empty">No events.</p>}</div>
  </div>;
}

export function CalculatorView({ content, items, busy, onChange }: Props) {
  const total = items.reduce((sum, item) => sum + numericValue(item.value), 0);
  return <div className="calculator-view"><div className="calculator-inputs">{items.map((item, i) => <label className="calculator-row" key={i}><span><strong>{item.name}</strong><span>{item.detail}</span></span><Input type="number" step="any" aria-label={item.name} value={item.value} disabled={busy} onChange={event => { if (content?.title) onChange({ ...content as Content, items: items.map((entry, index) => index === i ? { ...entry, value: event.target.value } : entry) }); }} /></label>)}</div><div className="calculator-total" aria-live="polite"><span>{content?.labels?.[0] || 'Total'}</span><output>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(total)}</output><span>{content?.labels?.[1]}</span></div></div>;
}

export function AccordionView({ items }: Props) {
  const [openAll, setOpenAll] = useState(false);
  return <div className="reference-view"><div className="reference-tools"><Button variant="ghost" onClick={() => setOpenAll(old => !old)}>{openAll ? 'Collapse all' : 'Expand all'}</Button></div>{items.map((item, i) => <details className="reference-entry" key={`${i}-${openAll}`} open={openAll}><summary><span>{item.name}</span><ChevronRight size={17} /></summary><p>{item.detail}</p>{item.value && <span className="reference-category">{item.value}</span>}</details>)}</div>;
}

export function TimerView({ items, busy }: Props) {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const safeActive = Math.min(active, Math.max(0, items.length - 1));
  const duration = Math.round(Math.max(1, Math.min(120, numericValue(items[safeActive]?.value) || 1)) * 60);
  const seconds = remaining ?? duration;
  useEffect(() => {
    if (!running) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) { setRunning(false); setFinished(true); }
    }, 250);
    return () => clearInterval(timer);
  // The deadline must remain fixed while this interval is running.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const choose = (index: number) => { setRunning(false); setActive(index); setRemaining(null); setFinished(false); };
  return <div className="timer-view"><div className="timer-face"><span>{items[safeActive]?.name}</span><output aria-label="Time remaining">{String(Math.floor(seconds / 60)).padStart(2, '0')}<span>:</span>{String(seconds % 60).padStart(2, '0')}</output><p>{items[safeActive]?.detail}</p><div className="timer-controls"><Button variant="ghost" size="icon" aria-label="Reset timer" onClick={() => { setRunning(false); setRemaining(null); setFinished(false); }}><RotateCcw size={18} /></Button><Button className="timer-play" aria-label={running ? 'Pause timer' : 'Start timer'} disabled={busy || !items.length || finished} onClick={() => setRunning(old => !old)}>{running ? <Pause size={20} /> : <Play size={20} />}</Button><Button variant="ghost" size="icon" aria-label="Next interval" disabled={safeActive + 1 >= items.length} onClick={() => choose(safeActive + 1)}><SkipForward size={18} /></Button></div><span className="sr-only" role="status">{finished ? 'Interval complete.' : ''}</span></div><div className="timer-queue">{items.map((item, i) => <button key={i} type="button" aria-pressed={safeActive === i} onClick={() => choose(i)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{item.name}</strong><span>{item.value} min</span></button>)}</div></div>;
}
