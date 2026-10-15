import { useId } from 'react';
import type { Content } from './schema';

export const numericValue = (value = '') => {
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function DataChart({ items, bars = false }: { items: Content['items']; bars?: boolean }) {
  const id = useId();
  const values = items.map(item => numericValue(item.value));
  const high = Math.max(1, ...values), low = Math.min(0, ...values);
  const x = (index: number) => 24 + index / Math.max(1, items.length - 1) * 552;
  const y = (value: number) => 148 - (value - low) / (high - low) * 124;
  const points = values.map((value, i) => `${x(i)},${y(value)}`);
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${point}`).join(' ');
  const baseline = y(0);
  return <div className={`data-chart ${bars ? 'is-bars' : 'is-area'}`}>
    <svg viewBox="0 0 600 174" preserveAspectRatio="none" role="img" aria-label={items.map(item => `${item.name}: ${item.value || 'pending'}`).join(', ')}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-solid)" stopOpacity="0.35" /><stop offset="100%" stopColor="var(--accent-solid)" stopOpacity="0" /></linearGradient></defs>
      {[24, 86, 148].map(pos => <line className="chart-guide" key={pos} x1="0" x2="600" y1={pos} y2={pos} />)}
      {bars ? values.map((value, i) => <rect className="data-bar" key={i} x={i / Math.max(1, values.length) * 552 + 24} y={Math.min(y(value), baseline)} width={Math.min(64, 400 / Math.max(1, values.length))} height={Math.max(2, Math.abs(baseline - y(value)))} rx="5" />) : <>
        {points.length > 1 && <path className="area-fill" d={`${line} L${x(items.length - 1)},${baseline} L24,${baseline} Z`} fill={`url(#${id})`} />}
        <path key={items.length} className="data-line" d={line} pathLength="1" />
        {values.map((value, i) => <circle className="data-point" key={i} cx={x(i)} cy={y(value)} r="4" />)}
      </>}
    </svg>
    <div className="chart-axis" aria-hidden="true">{items.map((item, i) => <span key={i}><strong>{item.value}</strong><span>{item.name}</span></span>)}</div>
  </div>;
}

export function CompletionRing({ done, total }: { done: number; total: number }) {
  const fraction = done / Math.max(1, total);
  return <div className="completion-ring" role="img" aria-label={`${done} of ${total} complete`}>
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle className="ring-track" cx="36" cy="36" r="29" /><circle className="ring-value" cx="36" cy="36" r="29" pathLength="100" strokeDasharray={`${fraction * 100} 100`} /></svg>
    <strong aria-hidden="true">{Math.round(fraction * 100)}<small>%</small></strong>
  </div>;
}
