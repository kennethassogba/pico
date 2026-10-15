import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock3, Columns2, LayoutGrid, Rows3, Layers3, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Content, Plan, ViewType } from './schema';
import { CompletionRing, DataChart } from './Graphics';
import { photoFor } from './media';
import { AccordionView, CalculatorView, CalendarView, TimerView } from './ExtraViews';
import { variants } from './schema';

type Props = { plan: Plan; content?: Partial<Content>; busy: boolean; onChange: (content: Content) => void };

function PendingView({ view }: { view: ViewType }) {
  if (view === 'gallery') return <div className="gallery-grid pending-collection">{[0, 1].map(i => <div key={i}><Skeleton className="cover-skeleton" /><Skeleton className="mt-4 h-4 w-2/3" /></div>)}</div>;
  if (view === 'board') return <div className="kanban-board">{[0, 1, 2].map(i => <div key={i}><Skeleton className="mb-4 h-3 w-20" /><Skeleton className="h-28 w-full" /></div>)}</div>;
  if (view === 'checklist') return <div className="task-list">{[0, 1, 2].map(i => <div className="task-row" key={i}><Checkbox disabled aria-label="Task loading" /><span className="task-copy"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></span></div>)}</div>;
  if (view === 'form') return <div className="generated-form">{[0, 1].map(i => <div className="field-label" key={i}><Skeleton className="h-3 w-24" /><Input disabled aria-label="Field loading" /></div>)}<Skeleton className="h-11 w-40" /></div>;
  if (view === 'pricing') return <Card className="pricing-grid"><CardContent><Skeleton className="h-5 w-24" /><Skeleton className="my-7 h-10 w-36" /><Skeleton className="my-4 h-4 w-3/4" /><Skeleton className="my-4 h-4 w-2/3" /><Skeleton className="mt-6 h-11 w-full" /></CardContent></Card>;
  if (view === 'comparison') return <div className="preview-skeleton">{[0, 1, 2].map(i => <div className="metric-grid" key={i}><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>)}</div>;
  return <div className="itinerary-list">{[0, 1, 2].map(i => <div className="itinerary-row" key={i}><Skeleton className="h-4 w-14" /><span className="timeline-dot" /><div><Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-3 w-32" /></div></div>)}</div>;
}


export function Preview({ plan, content, busy, onChange }: Props) {
  const [variant, setVariant] = useState(plan.variant || 'standard');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const [newTask, setNewTask] = useState('');
  const [invalidField, setInvalidField] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const collectionDialog = useRef<HTMLDialogElement>(null);
  const [stageHeight, setStageHeight] = useState(600);
  useEffect(() => {
    const stage = root.current?.closest('.preview-stage');
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => { setStageHeight(entry.contentRect.height); });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const items = (Array.isArray(content?.items) ? content.items : []).filter(item => item && typeof item.name === 'string').map(item => ({ image: item.image, name: item.name, detail: typeof item.detail === 'string' ? item.detail : '', value: typeof item.value === 'string' ? item.value : '' }));
  const photo = photoFor(plan.visual);
  const selectedItem = selected === null ? null : items[selected];
  const selectedPhoto = photoFor(selectedItem?.image);



  function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!newTask.trim() || !content?.title || busy) return;
    if (items.length >= 12) { setNotice('This preview holds 12 tasks.'); return; }
    onChange({ ...content as Content, items: [...items, { name: newTask.trim(), detail: '', value: 'Added' }] });
    setNewTask('');
  }

  return <div ref={root} className={`generated-view view-${plan.view} ${stageHeight < 440 ? 'is-compact' : ''}`} data-layout={variant} data-accent={plan.accent} data-synthesizing={busy || undefined} aria-label={`${plan.view} preview`} aria-busy={busy}>
    {photo && plan.view === 'itinerary' && <figure className="preview-photo"><img src={photo.src} alt={photo.alt} width="960" height="440" fetchPriority="high" /></figure>}
    <div className="view-heading">
      <div className="view-title"><h2>{content?.title || <Skeleton className="h-8 w-2/3" />}</h2></div>
      <div className="layout-options" role="group" aria-label="Composition">{variants.map((value, i) => { const Icon = [LayoutGrid, Rows3, Columns2][i]; return <button type="button" key={value} aria-label={`${value} composition`} aria-pressed={variant === value} onClick={() => setVariant(value)}><Icon size={16} /></button>; })}</div>
    </div>

    {items.length === 0 && !['dashboard', 'calendar', 'calculator', 'accordion', 'timer'].includes(plan.view) && <div aria-label="Filling interface content"><PendingView view={plan.view} /></div>}
    <>
      {plan.view === 'dashboard' && <>
        <div className="metric-grid" data-count={Math.max(2, Math.min(4, content?.metrics?.length || 0))}>{Array.from({ length: Math.max(2, Math.min(4, content?.metrics?.length || 0)) }, (_, i) => { const metric = content?.metrics?.[i]; return <div className="metric" key={i}>{metric ? <><span>{metric.label}</span><strong>{metric.value || <Skeleton className="h-7 w-20" />}</strong></> : <><Skeleton className="h-3 w-16" /><Skeleton className="mt-4 h-7 w-20" /></>}</div>; })}</div>
        <Card className="chart-card" aria-label={items.length === 0 ? "Filling interface content" : undefined}><CardContent><div className="chart-heading"><h3>{content?.labels?.[0] || 'Overview'}</h3><span className="chart-legend"><i />{content?.labels?.[1] || 'Value'}</span></div>
          <DataChart items={items} bars={plan.visual === 'bars'} disabled={busy} onChange={next => { if (content?.title) onChange({ ...content as Content, items: next }); }} />
        </CardContent></Card>
      </>}

      {items.length > 0 && <>
      {plan.view === 'checklist' && <>
        <div className="task-overview"><div><strong>{checked.size}<span> / {items.length}</span></strong><span>Tasks complete</span></div><CompletionRing done={checked.size} total={items.length} /></div>
        <div className="task-list">{items.map((item, i) => { const index = i; return <label className={`task-row ${checked.has(index) ? 'is-checked' : ''}`} key={index}>
          <Checkbox checked={checked.has(index)} onCheckedChange={value => setChecked(previous => { const next = new Set(previous); if (value) next.add(index); else next.delete(index); return next; })} aria-label={`Complete ${item.name}`} />
          <span className="task-copy"><strong>{item.name}</strong><span>{item.detail}</span></span>{item.value && <Badge variant="secondary">{item.value}</Badge>}
        </label>; })}</div>
        <form className="add-task" onSubmit={addTask}><Input aria-label="New task" placeholder="One more thing…" value={newTask} maxLength={100} onChange={e => setNewTask(e.target.value)} disabled={busy} /><Button type="submit" variant="outline" size="icon" aria-label="Add task" disabled={busy}><Plus /></Button></form>
      </>}

      {plan.view === 'form' && <form noValidate className="generated-form" onSubmit={e => {
        e.preventDefault();
        const fields = [...e.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')];
        const failed = fields.findIndex(field => !field.validity.valid);
        if (failed >= 0) {
          setInvalidField(failed); setNotice(fields[failed].validationMessage);
          fields[failed].focus(); fields[failed].reportValidity();
        } else { setInvalidField(null); setNotice('Preview submitted locally. Nothing was sent or saved.'); }
      }}>
        {items.map((item, index) => <label key={index} className="field-label">
          {item.name}{item.value === 'textarea' ? <Textarea name={`field-${index}`} placeholder={item.detail} disabled={busy} /> : <Input name={`field-${index}`} type={['email', 'date', 'number'].includes(item.value) ? item.value : 'text'} placeholder={item.detail} autoComplete={item.value === 'email' ? 'email' : /^(full )?name$/i.test(item.name) ? 'name' : 'off'} aria-invalid={invalidField === index} aria-describedby={invalidField === index ? 'preview-notice' : undefined} onChange={() => { if (invalidField === index) { setInvalidField(null); setNotice(''); } }} disabled={busy} />}
        </label>)}
        <Button className="preview-primary" type="submit" disabled={busy}>{content?.labels?.[0] || 'Submit preview'}<ArrowRight size={16} /></Button>
        
      </form>}

      {plan.view === 'pricing' && <div className="pricing-grid">{items.map((item, i) => { const index = i; return <Card key={index} className="price-card"><CardContent><div className="tier-graphic" aria-hidden="true">{[0, 1, 2].map(level => <span key={level} className={level <= index ? 'is-active' : ''} />)}</div>
        <div className="price-top"><h3>{item.name}</h3></div><div className="price">{item.value}</div>
        <details className={`price-features ${stageHeight >= 440 ? 'is-expanded' : ''}`} open={stageHeight >= 440}><summary>View features</summary><ul>{(item.detail || '').split(';').filter(Boolean).map((feature, j) => <li key={j}><Check size={15} />{feature.trim()}</li>)}</ul></details>
        <Button variant="outline" disabled={busy} className={selected === index ? 'is-selected' : ''} onClick={() => { setSelected(index); setNotice(`${item.name} selected in this preview. No purchase was made.`); }}>{selected === index ? <><Check size={16} /> Selected</> : <>Select {item.name}<ArrowRight size={16} /></>}</Button>
      </CardContent></Card>; })}</div>}

      {plan.view === 'comparison' && <div className="comparison-wrap"><Table><TableHeader><TableRow>{(content?.labels || ['Option', 'Details', 'Value']).slice(0, 3).map((label, i) => <TableHead key={i}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{items.map((item, i) => <TableRow key={i}><TableCell className="font-medium"><span className="comparison-name"><span className="option-symbol" aria-hidden="true"><Layers3 size={16} /></span>{item.name}</span></TableCell><TableCell>{item.detail}</TableCell><TableCell><span className="comparison-value">{item.value}</span></TableCell></TableRow>)}</TableBody></Table></div>}

      {plan.view === 'board' && <div className="kanban-board">{[0, 1, 2].map(column => <section className="kanban-column" key={column} aria-label={content?.labels?.[column] || ['Todo', 'Doing', 'Done'][column]}><h3><span className={`board-state state-${column}`} />{content?.labels?.[column] || ['Todo', 'Doing', 'Done'][column]}<span>{items.filter((item, i) => (statuses[i] ?? Math.max(0, ['Todo', 'Doing', 'Done'].indexOf(item.value))) === column).length}</span></h3>{items.map((item, i) => { const index = i; const status = statuses[index] ?? Math.max(0, ['Todo', 'Doing', 'Done'].indexOf(item.value)); return status === column && <Card className="board-card" key={index}><CardContent><span className="item-index">{String(index + 1).padStart(2, '0')}</span><h4>{item.name}</h4><p>{item.detail}</p><Button variant="ghost" disabled={busy} onClick={() => setStatuses(old => ({ ...old, [index]: (status + 1) % 3 }))} aria-label={`Move ${item.name} to ${['Todo', 'Doing', 'Done'][(status + 1) % 3]}`}>{['Todo', 'Doing', 'Done'][(status + 1) % 3]}<ArrowRight size={13} /></Button></CardContent></Card>; })}</section>)}</div>}

      {plan.view === 'gallery' && items.length > 0 && <div className="gallery-grid" data-count={items.length}>{items.map((item, i) => {
        const index = i, image = photoFor(item.image);
        return <button className={`gallery-entry ${image ? 'has-image' : 'is-typographic'} ${selected === index ? 'gallery-selected' : ''}`} key={index} aria-pressed={selected === index} onClick={() => { setSelected(index); collectionDialog.current?.showModal(); }}>
          {image ? <img src={image.src} alt={image.alt} width="960" height="640" loading="eager" /> : <span className="type-cover" data-edition={index % 3}><span className="cover-category">{item.value}</span><strong>{item.name}</strong><ArrowUpRight size={26} aria-hidden="true" /></span>}
          <span className="gallery-caption"><span>{image && <strong>{item.name}</strong>}<span>{item.detail}</span></span><span className="gallery-tag">{image && item.value}<ArrowUpRight size={16} aria-hidden="true" /></span></span>
        </button>;
      })}</div>}

      {plan.view === 'itinerary' && <div className="itinerary-list">{items.map((item, i) => <div className="itinerary-row" key={i}><span className="time">{item.value}</span><span className="timeline-dot" aria-hidden="true"><Clock3 size={15} /></span><div><h3>{item.name}</h3><p>{item.detail}</p></div></div>)}</div>}

      {plan.view === 'calendar' && <CalendarView content={content} items={items} busy={busy} onChange={onChange} />}
      {plan.view === 'calculator' && <CalculatorView content={content} items={items} busy={busy} onChange={onChange} />}
      {plan.view === 'accordion' && <AccordionView content={content} items={items} busy={busy} onChange={onChange} />}
      {plan.view === 'timer' && <TimerView content={content} items={items} busy={busy} onChange={onChange} />}
      </>}
    </>
    <dialog ref={collectionDialog} className="info-dialog collection-dialog" onClick={event => { if (event.target === event.currentTarget) collectionDialog.current?.close(); }}>
      <div className="dialog-heading"><h2>{selectedItem?.name}</h2><Button variant="ghost" size="icon" aria-label="Close collection item" onClick={() => collectionDialog.current?.close()}><X size={20} /></Button></div>
      {selectedPhoto && <img src={selectedPhoto.src} alt={selectedPhoto.alt} />}
      <p>{selectedItem?.detail}</p><span className="collection-value">{selectedItem?.value}</span>
    </dialog>
    <p id="preview-notice" className="local-notice" role="status">{notice}</p>
  </div>;
}

export const samplePrompts: { type: ViewType; label: string; prompt: string }[] = [
  { type: 'dashboard', label: 'Track my spending', prompt: 'Make a monthly spending dashboard with sample data in euros.' },
  { type: 'gallery', label: 'A listening room', prompt: 'Make a collection of six listening sessions for a small record club: one on vinyl, one ambient, one house.' },
  { type: 'itinerary', label: 'A weekend in Kyoto', prompt: 'Plan a relaxed two-day weekend in Kyoto with four activities and times.' },
  { type: 'calendar', label: 'Publication calendar', prompt: 'Make an editorial calendar with eight dated posts this month.' },
  { type: 'calculator', label: 'Estimate a project', prompt: 'Build an editable estimate in euros for a small software project with six cost inputs and their total.' },
  { type: 'timer', label: 'A focus session', prompt: 'Make a focus timer with five work and rest intervals, with start, pause and reset.' },
  { type: 'board', label: 'Plan a launch', prompt: 'Make a kanban board with nine concrete tasks for a software release, spread across Todo, Doing and Done.' },
  { type: 'accordion', label: 'Coffee questions', prompt: 'Make six expandable questions and answers about brewing East African coffee at home.' },
  { type: 'pricing', label: 'Compare plans', prompt: 'Make three subscription plans for a collaborative notes app with prices and concrete features.' },
  { type: 'comparison', label: 'Compare databases', prompt: 'Compare eight databases for a small web app in a compact table with concrete tradeoffs.' },
  { type: 'checklist', label: 'Release checklist', prompt: 'Make an eight-item software release checklist with concrete checks.' },
  { type: 'form', label: 'Collect some feedback', prompt: 'Make a short feedback form for a new coffee shop with name, email, and a comment.' },
];
