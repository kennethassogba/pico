import { useId, useRef, useState } from 'react';
import { ChartColumn, ChartNoAxesCombined, RotateCcw } from 'lucide-react';
import type { Content } from './schema';

export const numericValue = (value = '') => {
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function DataChart({ items, bars = false, disabled = false, onChange }: { items: Content['items']; bars?: boolean; disabled?: boolean; onChange?: (items: Content['items']) => void }) {
  const id = useId();
  const [mode, setMode] = useState(bars);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ index: number; low: number; high: number; svgTop: number; svgHeight: number } | null>(null);
  const initial = useRef<Content['items'] | null>(null);
  const values = items.map(item => numericValue(item.value));
  const high = drag.current?.high ?? Math.max(1, ...values) * 1.15;
  const low = drag.current?.low ?? Math.min(0, ...values) * 1.15;
  const x = (index: number) => 24 + index / Math.max(1, items.length - 1) * 552;
  const y = (value: number) => 148 - (value - low) / (high - low) * 124;
  const points = values.map((value, i) => `${x(i)},${y(value)}`);
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${point}`).join(' ');
  const baseline = y(0);
  const step = Math.max(.1, Math.round((high - low) / 100 * 10) / 10);
  const change = (index: number, value: number) => {
    if (disabled || !onChange || !Number.isFinite(value)) return;
    initial.current ??= items.map(item => ({ ...item }));
    onChange(items.map((item, i) => i === index ? { ...item, value: String(Math.round(value * 100) / 100) } : item));
  };
  const current = selected === null ? null : items[selected];
  return <div className={`data-chart ${mode ? 'is-bars' : 'is-area'}`}>
    <div className="chart-tools">
      <div className="chart-modes" role="group" aria-label="Chart type">
        <button type="button" aria-label="Line chart" aria-pressed={!mode} onClick={() => setMode(false)}><ChartNoAxesCombined size={17} /></button>
        <button type="button" aria-label="Bar chart" aria-pressed={mode} onClick={() => setMode(true)}><ChartColumn size={17} /></button>
      </div>
      {current && <output className="chart-readout">{current.name}<strong>{current.value}</strong></output>}
      <button className="chart-reset" type="button" aria-label="Reset chart values" disabled={disabled || !initial.current} onClick={() => { if (initial.current) onChange?.(initial.current); initial.current = null; }}><RotateCcw size={15} /></button>
    </div>
    <svg viewBox="0 0 600 174" preserveAspectRatio="none" role="group" aria-label="Editable chart">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-solid)" stopOpacity="0.25" /><stop offset="100%" stopColor="var(--accent-solid)" stopOpacity="0" /></linearGradient></defs>
      {[24, 86, 148].map(pos => <line className="chart-guide" key={pos} x1="0" x2="600" y1={pos} y2={pos} />)}
      {mode ? values.map((value, i) => <rect className="data-bar" key={i} x={x(i) - Math.min(24, 220 / Math.max(1, values.length))} y={Math.min(y(value), baseline)} width={Math.min(48, 440 / Math.max(1, values.length))} height={Math.max(2, Math.abs(baseline - y(value)))} rx="4" />) : <>
        {points.length > 1 && <path className="area-fill" d={`${line} L${x(items.length - 1)},${baseline} L24,${baseline} Z`} fill={`url(#${id})`} />}
        <path className="data-line" d={line} />
        {values.map((value, i) => <circle className="data-point" key={i} cx={x(i)} cy={y(value)} r={selected === i ? 6 : 4} />)}
      </>}
      {values.map((value, i) => <circle className="chart-handle" key={i} cx={x(i)} cy={y(value)} r="28" tabIndex={disabled ? -1 : 0}
        role="slider" aria-label={items[i].name} aria-valuemin={Math.min(low, value)} aria-valuemax={Math.max(high, value)} aria-valuenow={value} aria-valuetext={items[i].value} aria-disabled={disabled}
        onFocus={() => setSelected(i)} onPointerEnter={() => setSelected(i)}
        onPointerDown={event => {
          if (disabled) return;
          const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
          drag.current = { index: i, low, high, svgTop: bounds.top, svgHeight: bounds.height };
          event.currentTarget.setPointerCapture(event.pointerId); setSelected(i);
        }}
        onPointerMove={event => {
          const active = drag.current;
          if (!active || active.index !== i) return;
          const pos = Math.max(24, Math.min(148, (event.clientY - active.svgTop) / active.svgHeight * 174));
          change(i, active.low + (148 - pos) / 124 * (active.high - active.low));
        }}
        onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
          if (disabled) return;
          const direction = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : 0;
          if (direction) { event.preventDefault(); change(i, value + direction * step * (event.shiftKey ? 10 : 1)); }
        }} />)}
    </svg>
    <div className="chart-axis">{items.map((item, i) => <label key={i}><input type="number" step="any" aria-label={`${item.name} value`} value={numericValue(item.value)} disabled={disabled} onFocus={() => setSelected(i)} onChange={event => { if (event.target.value !== '') change(i, Number(event.target.value)); }} /><span>{item.name}</span></label>)}</div>
  </div>;
}

export function CompletionRing({ done, total }: { done: number; total: number }) {
  const fraction = done / Math.max(1, total);
  return <div className="completion-ring" role="img" aria-label={`${done} of ${total} complete`}>
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle className="ring-track" cx="36" cy="36" r="29" /><circle className="ring-value" cx="36" cy="36" r="29" pathLength="100" strokeDasharray={`${fraction * 100} 100`} /></svg>
    <strong aria-hidden="true">{Math.round(fraction * 100)}<small>%</small></strong>
  </div>;
}
