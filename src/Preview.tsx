import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Content, Plan, ViewType } from './schema';

type Props = { plan: Plan; content?: Partial<Content>; busy: boolean; onChange: (content: Content) => void };

function PendingView({ view }: { view: ViewType }) {
  if (view === 'dashboard') return <><div className="metric-grid">{[0, 1, 2].map(i => <Card key={i}><CardContent><Skeleton className="h-3 w-16" /><Skeleton className="mt-4 h-7 w-20" /></CardContent></Card>)}</div><Card><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card></>;
  if (view === 'checklist') return <div className="task-list">{[0, 1, 2].map(i => <div className="task-row" key={i}><Checkbox disabled aria-label="Task loading" /><span className="task-copy"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></span></div>)}</div>;
  if (view === 'form') return <div className="generated-form">{[0, 1].map(i => <div className="field-label" key={i}><Skeleton className="h-3 w-24" /><Input disabled aria-label="Field loading" /></div>)}<Skeleton className="h-11 w-40" /></div>;
  if (view === 'pricing') return <Card className="pricing-grid"><CardContent><Skeleton className="h-5 w-24" /><Skeleton className="my-7 h-10 w-36" /><Skeleton className="my-4 h-4 w-3/4" /><Skeleton className="my-4 h-4 w-2/3" /><Skeleton className="mt-6 h-11 w-full" /></CardContent></Card>;
  if (view === 'comparison') return <div className="preview-skeleton">{[0, 1, 2].map(i => <div className="metric-grid" key={i}><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>)}</div>;
  return <div className="itinerary-list">{[0, 1, 2].map(i => <div className="itinerary-row" key={i}><Skeleton className="h-4 w-14" /><span className="timeline-dot" /><div><Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-3 w-32" /></div></div>)}</div>;
}


function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return <nav aria-label="Preview pages" className="pager">
    <Button variant="ghost" size="icon" aria-label="Previous preview page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
    <span>{page + 1} / {pages}</span>
    <Button variant="ghost" size="icon" aria-label="Next preview page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
  </nav>;
}

export function Preview({ plan, content, busy, onChange }: Props) {
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [newTask, setNewTask] = useState('');
  const [invalidField, setInvalidField] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(600);
  useEffect(() => {
    const stage = root.current?.closest('.preview-stage');
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageHeight(entry.contentRect.height));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const items = (content?.items ?? []).filter(item => item && typeof item.name === 'string');
  const pageSize = plan.view === 'pricing' || stageHeight < 440 ? 1 : plan.view === 'form' || stageHeight < 600 ? 2 : 3;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const number = (value: string) => { const parsed = Number(value.replace(/[^\d.-]/g, '')); return Number.isFinite(parsed) ? Math.abs(parsed) : 0; };
  const maxValue = Math.max(1, ...items.map(item => number(item.value || '')));

  function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!newTask.trim() || !content?.title || busy) return;
    if (items.length >= 6) { setNotice('This preview holds 6 tasks. Refine the list in chat to change it.'); return; }
    onChange({ ...content as Content, items: [...items, { name: newTask.trim(), detail: '', value: 'Added' }] });
    setPage(Math.floor(items.length / pageSize)); setNewTask(''); setNotice('Task added to this preview.');
  }

  return <div ref={root} className={`generated-view view-${plan.view} ${stageHeight < 440 ? 'is-compact' : ''}`} data-accent={plan.accent} aria-label={`${plan.view} preview`} aria-busy={busy}>
    <div className="view-heading">
      <h2>{content?.title || <Skeleton className="h-8 w-2/3" />}</h2>
      {content?.description ? <p>{content.description}</p> : <Skeleton className="mt-3 h-4 w-4/5" />}
    </div>

    {items.length === 0 ? <div aria-label="Filling interface content"><PendingView view={plan.view} /></div> : <>
      {plan.view === 'dashboard' && <>
        <div className="metric-grid">{content?.metrics?.filter(Boolean).slice(0, 3).map((metric, i) => <Card key={i}><CardContent><span>{metric.label}</span><strong>{metric.value}</strong></CardContent></Card>)}</div>
        <Card className="chart-card"><CardContent><div className="chart-heading"><h3>{content?.labels?.[0] || 'Overview'}</h3></div>
          <div className="chart" role="img" aria-label={items.map(item => `${item.name}: ${item.value}`).join(', ')}>{items.map((item, i) => <div className="chart-column" key={i}><span className="chart-value">{item.value}</span><div className="chart-track"><div className="chart-bar" style={{ height: `${Math.max(3, number(item.value || '') / maxValue * 100)}%` }} /></div><span className="chart-label">{item.name}</span></div>)}</div>
        </CardContent></Card>
      </>}

      {plan.view === 'checklist' && <>
        <div className="list-summary"><span>{checked.size} of {items.length} complete</span><span>{Math.round(checked.size / Math.max(1, items.length) * 100)}%</span></div>
        <div className="progress-track" role="progressbar" aria-label="Tasks complete" aria-valuenow={checked.size} aria-valuemin={0} aria-valuemax={items.length}><div style={{ width: `${checked.size / Math.max(1, items.length) * 100}%` }} /></div>
        <div className="task-list">{visible.map((item, i) => { const index = currentPage * pageSize + i; return <label className={`task-row ${checked.has(index) ? 'is-checked' : ''}`} key={index}>
          <Checkbox checked={checked.has(index)} disabled={busy} onCheckedChange={value => setChecked(previous => { const next = new Set(previous); if (value) next.add(index); else next.delete(index); return next; })} aria-label={`Complete ${item.name}`} />
          <span className="task-copy"><strong>{item.name}</strong><span>{item.detail}</span></span>{item.value && <Badge variant="secondary">{item.value}</Badge>}
        </label>; })}</div>
        <form className="add-task" onSubmit={addTask}><Input aria-label="New task" placeholder="One more thing…" value={newTask} maxLength={100} onChange={e => setNewTask(e.target.value)} disabled={busy} /><Button type="submit" variant="outline" size="icon" aria-label="Add task" disabled={busy}><Plus /></Button></form>
      </>}

      {plan.view === 'form' && <form noValidate className="generated-form" onSubmit={e => {
        e.preventDefault();
        const fields = [...e.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')];
        const failed = fields.findIndex(field => !field.validity.valid);
        if (failed >= 0) {
          setPage(Math.floor(failed / pageSize)); setInvalidField(failed); setNotice(fields[failed].validationMessage);
          requestAnimationFrame(() => fields[failed].reportValidity());
        } else { setInvalidField(null); setNotice('Preview submitted locally. Nothing was sent or saved.'); }
      }}>
        {items.map((item, index) => <label key={index} className="field-label" hidden={index < currentPage * pageSize || index >= (currentPage + 1) * pageSize}>
          {item.name}{item.value === 'textarea' ? <Textarea name={`field-${index}`} placeholder={item.detail} disabled={busy} /> : <Input name={`field-${index}`} type={['email', 'date', 'number'].includes(item.value) ? item.value : 'text'} placeholder={item.detail} autoComplete={item.value === 'email' ? 'email' : /^(full )?name$/i.test(item.name) ? 'name' : 'off'} aria-invalid={invalidField === index} aria-describedby={invalidField === index ? 'preview-notice' : undefined} onChange={() => { if (invalidField === index) { setInvalidField(null); setNotice(''); } }} disabled={busy} />}
        </label>)}
        <Button className="preview-primary" type="submit" disabled={busy}>{content?.labels?.[0] || 'Submit preview'}<ArrowRight size={16} /></Button>
        
      </form>}

      {plan.view === 'pricing' && <div className="pricing-grid">{visible.map((item, i) => { const index = currentPage * pageSize + i; return <Card key={index} className="price-card"><CardContent>
        <div className="price-top"><h3>{item.name}</h3><Badge variant="secondary">{index + 1} of {items.length}</Badge></div><div className="price">{item.value}</div>
        <details className={`price-features ${stageHeight >= 440 ? 'is-expanded' : ''}`} open={stageHeight >= 440}><summary>View features</summary><ul>{(item.detail || '').split(';').filter(Boolean).map((feature, j) => <li key={j}><Check size={15} />{feature.trim()}</li>)}</ul></details>
        <Button variant="outline" disabled={busy} className={selected === index ? 'is-selected' : ''} onClick={() => { setSelected(index); setNotice(`${item.name} selected in this preview. No purchase was made.`); }}>{selected === index ? <><Check size={16} /> Selected</> : <>Select {item.name}<ArrowRight size={16} /></>}</Button>
      </CardContent></Card>; })}</div>}

      {plan.view === 'comparison' && <div className="comparison-wrap"><Table><TableHeader><TableRow>{(content?.labels || ['Option', 'Details', 'Value']).slice(0, 3).map((label, i) => <TableHead key={i}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{visible.map((item, i) => <TableRow key={i}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.detail}</TableCell><TableCell>{item.value}</TableCell></TableRow>)}</TableBody></Table></div>}

      {plan.view === 'itinerary' && <div className="itinerary-list">{visible.map((item, i) => <div className="itinerary-row" key={i}><span className="time">{item.value}</span><span className="timeline-dot" aria-hidden="true" /><div><h3>{item.name}</h3><p>{item.detail}</p></div></div>)}</div>}

      {plan.view !== 'dashboard' && <Pager page={currentPage} pages={pages} setPage={setPage} />}
    </>}
    <p id="preview-notice" className="local-notice" role="status">{notice}</p>
  </div>;
}

export const samplePrompts: { type: ViewType; label: string; prompt: string }[] = [
  { type: 'dashboard', label: 'Track my spending', prompt: 'Make a monthly spending dashboard with sample data in euros.' },
  { type: 'checklist', label: 'Plan a small launch', prompt: 'Make a checklist for launching a small personal website this weekend.' },
  { type: 'itinerary', label: 'A weekend in Kyoto', prompt: 'Plan a relaxed two-day weekend in Kyoto with four activities and times.' },
  { type: 'form', label: 'Collect some feedback', prompt: 'Make a short feedback form for a new coffee shop with name, email, and a comment.' },
];
