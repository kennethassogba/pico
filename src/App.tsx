import { useEffect, useRef, useState } from 'react';
import { parse } from 'partial-json';
import { ArrowRight, ArrowUp, ArrowUpRight, Download, Check, CircleHelp, Copy, LoaderCircle, Plus, Share2, Shuffle, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Preview, samplePrompts } from './Preview';
import { contentSchema, viewNames, type Content, type Plan, type Result } from './schema';
import { DECIDER, GENERATOR } from './models';
import { photoFor } from './media';

type Phase = 'idle' | 'deciding' | 'filling';
type Entry = { role: 'user' | 'assistant'; content: string };
const timing = (ms: number) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [exampleOffset, setExampleOffset] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [content, setContent] = useState<Partial<Content>>();
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const backup = useRef<Result | null>(null);
  const revision = useRef(0);
  const touched = useRef(false);
  const busy = phase !== 'idle';

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (!shared) return; const timer = setTimeout(() => setShared(false), 2500); return () => clearTimeout(timer); }, [shared]);
  useEffect(() => { const field = input.current; if (field) { field.style.height = 'auto'; field.style.height = `${Math.min(120, Math.max(48, field.scrollHeight))}px`; } }, [prompt]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport && viewport.scale !== 1) return;
        document.documentElement.style.setProperty('--app-height', `${viewport?.height || window.innerHeight}px`);
        document.documentElement.style.setProperty('--app-top', `${Math.max(0, viewport?.offsetTop || 0)}px`);
      });
    };
    resize();
    viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, []);

  function restore() { const old = backup.current; setResult(old); setPlan(old?.plan ?? null); setContent(old?.content); }

  async function generate(text: string) {
    if (busy || text.trim().length < 3) {
      if (!busy) { setError('Describe your idea in at least 3 characters.'); input.current?.focus(); }
      return;
    }
    controller.current?.abort();
    const run = ++revision.current; touched.current = false;
    const abort = new AbortController(); controller.current = abort;
    backup.current = result;
    if (window.matchMedia('(pointer: coarse)').matches) input.current?.blur();
    setError(''); setNotice(''); setPhase('deciding'); setLastPrompt(text.trim()); setPrompt('');
    let nextPlan: Plan | null = null, generated = '', completed = false;
    let paint = 0;
    const flush = () => { paint = 0; if (run !== revision.current) return; try { const partial = parse(generated); if (partial && typeof partial === 'object' && !Array.isArray(partial)) setContent(partial); } catch { /* Partial strings and arrays are expected. */ } };
    const timeout = setTimeout(() => abort.abort('timeout'), 18_000);
    try {
      const response = await fetch('/pico/api/generate', {
        method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text.trim(), history: history.slice(-6), ...(result ? { previous: { view: result.plan.view, content: result.content } } : {}) }),
      });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'Pico could not connect. Try again.'); }
      if (!response.body) throw new Error('The connection closed. Try again.');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done || run !== revision.current) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === 'error') throw new Error(event.error);
            if (event.type === 'plan') { nextPlan = event.plan; setPlan(nextPlan); setContent(undefined); setPreviewKey(v => v + 1); setPhase('filling'); }
            if (event.type === 'delta') {
              generated += event.text;
              if (!paint) paint = requestAnimationFrame(flush);
            }
            if (event.type === 'reset') { cancelAnimationFrame(paint); paint = 0; generated = ''; setContent(undefined); }
            if ((event.type === 'complete' || (event.type === 'upgrade' && !touched.current)) && nextPlan) {
              cancelAnimationFrame(paint); paint = 0;
              const valid = contentSchema.parse(event.content);
              const next = { plan: nextPlan, content: valid, generationModel: event.generationModel, totalMs: event.totalMs };
              setContent(valid); setResult(next); backup.current = next; completed = true; setPhase('idle');
              if (event.type === 'complete') setHistory(old => [...old, { role: 'user' as const, content: text.trim() }, { role: 'assistant' as const, content: `Created ${viewNames[nextPlan!.view].toLowerCase()}: ${valid.title}` }].slice(-6));
            }
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (!completed) throw new Error('The connection ended before the interface was ready. Try again.');
    } catch (err) {
      if (run !== revision.current || completed) return;
      restore();
      if (abort.signal.aborted && abort.signal.reason !== 'timeout') setNotice('Stopped. Your previous preview is still here.');
      else setError(abort.signal.reason === 'timeout' ? 'The model took too long. Try again with a shorter request.' : err instanceof Error ? err.message : 'Pico could not connect. Try again.');
      setPrompt(text.trim());
    } finally { cancelAnimationFrame(paint); clearTimeout(timeout); if (run === revision.current) { controller.current = null; setPhase('idle'); } }
  }

  function startOver() {
    revision.current++; controller.current?.abort(); controller.current = null; setPhase('idle');
    if (result) backup.current = result;
    setResult(null); setPlan(null); setContent(undefined); setHistory([]); setError(''); setLastPrompt(''); setPrompt('');
    setNotice('Started a fresh preview.'); input.current?.focus();
  }

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ ...result, source: 'https://keff.uk/pico', sampleData: true }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'pico-interface.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Interface data downloaded.');
  }

  async function shareApp() {
    const data = { title: 'Pico', url: 'https://keff.uk/pico/' };
    if (navigator.share) {
      try { await navigator.share(data); return; }
      catch (err) { if (err instanceof Error && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(data.url); setShared(true); setNotice('App link copied.'); }
    catch { setShareError('Copy the link below.'); shareDialog.current?.showModal(); }
  }
  function openHelp() { help.current?.showModal(); }
  const status = phase === 'deciding' ? 'Choosing a layout…' : phase === 'filling' ? 'Filling your interface…' : result ? 'Ready to try' : 'Ready for an idea';
  const photos = [...new Set([plan?.visual, ...(Array.isArray(content?.items) ? content.items : []).filter(item => item && typeof item === 'object').map(item => item.image)])].map(photoFor).filter(Boolean);

  return <div className={`app-shell ${plan || busy || error ? 'has-preview' : 'is-empty'}`}>
    <a className="skip-link" href="#prompt">Skip to prompt</a>
    <header className="app-header">
      <a className="brand" href="/pico/" aria-label="Pico home">pico</a>
      <div className="header-actions">
        {(result || lastPrompt) && <Button variant="ghost" size="icon" onClick={startOver} disabled={busy} aria-label="Start a new preview"><Plus size={20} /></Button>}
        <Button className="share-button" variant="ghost" size="icon" onClick={() => void shareApp()} aria-label="Share Pico" title={shared ? "Link copied" : "Share Pico"}>{shared ? <Check size={18} /> : <Share2 size={18} />}{shared && <span className="share-feedback" role="status">Link copied</span>}</Button>
        <Button variant="ghost" size="icon" onClick={openHelp} aria-label="About Pico" title="About the experiment"><CircleHelp size={19} /></Button>
      </div>
    </header>
    <main className="workspace">
      {!plan && !busy && !error && <div className="empty-state"><h1 className="empty-heading">What would you like to make?</h1></div>}
      {(plan || busy || error) && <section className="preview-panel" aria-label="Generated interface">
        <h1 className="sr-only">Your interface</h1>
        {lastPrompt && <button className="request-bubble" onClick={() => historyDialog.current?.showModal()} aria-label="View chat"><span>{lastPrompt}</span></button>}
        <div className="preview-stage" onPointerDownCapture={() => { touched.current = true; }} onKeyDownCapture={() => { touched.current = true; }} role="region" aria-label="Interface preview" tabIndex={0}><div className="stage-inner">
          {plan ? <Preview key={previewKey} plan={plan} content={content} busy={busy} onChange={next => { touched.current = true; setContent(next); setResult(old => old ? { ...old, content: next } : old); }} /> : busy ? <div className="choosing-state" role="status"><LoaderCircle className="spinner" size={20} /><span>Choosing a layout…</span></div> : null}
        </div></div>
      </section>}
      <div className="composer-area">
        {!lastPrompt && !busy && <div className="examples" aria-label="Example requests">{[0, 1, 2].map(index => samplePrompts[(exampleOffset + index) % samplePrompts.length]).map(sample => <button key={sample.type} onClick={() => void generate(sample.prompt)}>{sample.label}<ArrowUpRight size={14} /></button>)}<button className="examples-more" type="button" aria-label="More examples" onClick={() => setExampleOffset(old => (old + 3) % samplePrompts.length)}><Shuffle size={16} /></button></div>}

        <div id="prompt-error" className="error-message" role="alert">{error && <><span>{error}</span><button onClick={() => void generate(prompt || lastPrompt)}>Try again</button></>}</div>
        <form className="composer" onSubmit={event => { event.preventDefault(); void generate(prompt); }}>
          <label htmlFor="prompt" className="sr-only">Describe your interface</label>
          <Textarea id="prompt" ref={input} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1200} placeholder={result ? 'What would you change?' : 'Describe your interface'} rows={1} aria-describedby={error ? 'prompt-error' : undefined} aria-invalid={error.startsWith('Describe your idea')} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void generate(prompt); } }} />
          {busy ? <Button type="button" size="icon" onClick={() => controller.current?.abort()} aria-label="Stop generation"><Square size={16} /></Button> : <Button type="submit" size="icon" aria-label="Generate interface"><ArrowUp size={21} /></Button>}
        </form>
      </div>
    </main>
    <div role="status" className="sr-only">{status}{notice ? `. ${notice}` : ''}</div>
    <dialog ref={help} className="info-dialog" onClick={event => { if (event.target === event.currentTarget) help.current?.close(); }}>
      <div className="dialog-heading"><h2>About Pico</h2><Button variant="ghost" size="icon" onClick={() => help.current?.close()} aria-label="Close about Pico"><X size={20} /></Button></div>
      <p className="experiment-intro">Pico is an experiment in decision models.</p>
      <p>Describe a task. Luna chooses the components, then fills them as it responds. Change your request and the interface changes with it.</p>
      <div className="experiment-flow" aria-label="A prompt becomes a decision, then an interactive interface"><span>Prompt</span><ArrowRight size={16} aria-hidden="true" /><span>Decision</span><ArrowRight size={16} aria-hidden="true" /><span>Interface</span></div>
      <p>The experiment tests how little a model needs to decide before an interface becomes useful. Layouts are prebuilt; their content arrives live.</p>
      <details className="technical-details"><summary>Models &amp; privacy</summary>
      <dl><dt>Layout</dt><dd>{DECIDER} · Decisions</dd><dt>Content</dt><dd>{result?.generationModel || GENERATOR} · Responses</dd>{result && <><dt>Response time</dt><dd>Layout: {timing(result.plan.decisionMs)} · Content: {timing(result.totalMs)}</dd></>}</dl>
      <p>Content and photos are illustrative. Edits stay in this tab. Prompts and the current preview are sent to OpenAI with response storage disabled. Pico does not store conversations.</p>
      {photos.length > 0 && <p>Illustrative photos: {photos.map((photo, i) => <span key={photo!.src}>{i > 0 && ", "}<a href={photo!.source} target="_blank" rel="noreferrer">{photo!.author} on Unsplash</a></span>)}.</p>}
      </details>
      <div className="detail-actions">{result && <Button variant="outline" onClick={download}><Download size={16} />Download data</Button>}<a href="https://github.com/kennethassogba/pico" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={14} /></a><a href="https://keff.uk/">k<sub>eff</sub><ArrowUpRight size={14} /></a></div>
      {result && <details className="data-details"><summary>Interface data</summary><pre tabIndex={0} aria-label="Interface JSON">{JSON.stringify({ view: result.plan.view, ...result.content }, null, 2)}</pre></details>}
    </dialog>
    <dialog ref={shareDialog} className="info-dialog"><div className="dialog-heading"><h2>Share Pico</h2><Button variant="ghost" size="icon" onClick={() => shareDialog.current?.close()} aria-label="Close share link"><X size={20} /></Button></div><p>{shareError}</p><label className="share-link">App link<input value="https://keff.uk/pico/" readOnly onFocus={e => e.currentTarget.select()} /></label><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText('https://keff.uk/pico/'); setShared(true); shareDialog.current?.close(); } catch { setShareError('Select the link and copy it from your browser.'); } }}><Copy size={16} />Copy link</Button></dialog>
    <dialog ref={historyDialog} className="info-dialog history-dialog"><div className="dialog-heading"><h2>This chat</h2><Button variant="ghost" size="icon" onClick={() => historyDialog.current?.close()} aria-label="Close chat history"><X size={20} /></Button></div>{history.map((entry, i) => <div className={`history-entry ${entry.role}`} key={i}><strong>{entry.role === 'user' ? 'You' : 'Pico'}</strong><p>{entry.content}</p></div>)}{lastPrompt && !history.some(entry => entry.role === 'user' && entry.content === lastPrompt) && <p>{lastPrompt}</p>}</dialog>
  </div>;
}
