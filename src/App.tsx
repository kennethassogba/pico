import { useEffect, useRef, useState } from 'react';
import { parse } from 'partial-json';
import { ArrowUp, ArrowUpRight, Download, LoaderCircle, MoreHorizontal, Plus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Preview, samplePrompts } from './Preview';
import { contentSchema, viewNames, type Content, type Plan, type Result } from './schema';
import { GENERATOR } from './models';
import { media } from './media';

type Phase = 'idle' | 'deciding' | 'filling';
type Entry = { role: 'user' | 'assistant'; content: string };
const timing = (ms: number) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [content, setContent] = useState<Partial<Content>>();
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const backup = useRef<Result | null>(null);
  const busy = phase !== 'idle';

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--app-height', `${viewport?.height || window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize);
    return () => viewport?.removeEventListener('resize', resize);
  }, []);

  function restore() { const old = backup.current; setResult(old); setPlan(old?.plan ?? null); setContent(old?.content); }

  async function generate(text: string) {
    if (controller.current || text.trim().length < 3) {
      if (!controller.current) { setError('Describe your idea in at least 3 characters.'); input.current?.focus(); }
      return;
    }
    const abort = new AbortController(); controller.current = abort;
    backup.current = result;
    setError(''); setNotice(''); setPhase('deciding'); setLastPrompt(text.trim()); setPrompt('');
    let nextPlan: Plan | null = null, generated = '', completed = false;
    const timeout = setTimeout(() => abort.abort('timeout'), 65_000);
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
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === 'error') throw new Error(event.error);
            if (event.type === 'plan') { nextPlan = event.plan; setPlan(nextPlan); setContent(undefined); setPreviewKey(v => v + 1); setPhase('filling'); }
            if (event.type === 'delta') {
              generated += event.text;
              try { const partial = parse(generated); if (partial && typeof partial === 'object' && !Array.isArray(partial)) setContent(partial); } catch { /* Incomplete JSON is expected while streaming. */ }
            }
            if (event.type === 'reset') { generated = ''; setContent(undefined); }
            if (event.type === 'complete' && nextPlan) {
              const valid = contentSchema.parse(event.content);
              const next = { plan: nextPlan, content: valid, generationModel: event.generationModel, totalMs: event.totalMs };
              setContent(valid); setResult(next); backup.current = next; completed = true;
              setHistory(old => [...old, { role: 'user' as const, content: text.trim() }, { role: 'assistant' as const, content: `Created ${viewNames[nextPlan!.view].toLowerCase()}: ${valid.title}` }].slice(-6));
            }
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (!completed) throw new Error('The connection ended before the interface was ready. Try again.');
    } catch (err) {
      restore();
      if (abort.signal.aborted && abort.signal.reason !== 'timeout') setNotice('Stopped. Your previous preview is still here.');
      else setError(abort.signal.reason === 'timeout' ? 'The model took too long. Try again with a shorter request.' : err instanceof Error ? err.message : 'Pico could not connect. Try again.');
      setPrompt(text.trim());
    } finally { clearTimeout(timeout); controller.current = null; setPhase('idle'); }
  }

  function startOver() {
    controller.current?.abort();
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

  function openHelp() { help.current?.showModal(); }
  const status = phase === 'deciding' ? 'Choosing a layout…' : phase === 'filling' ? 'Filling your interface…' : result ? 'Ready to try' : 'Ready for an idea';
  const photo = plan?.visual === 'kyoto' || plan?.visual === 'coffee' ? media[plan.visual] : null;

  return <div className={`app-shell ${plan || busy || error ? 'has-preview' : 'is-empty'}`}>
    <a className="skip-link" href="#prompt">Skip to prompt</a>
    <header className="app-header">
      <a className="brand" href="/pico/" aria-label="Pico home">pico</a>
      <div className="header-actions">
        {(result || lastPrompt) && <Button variant="ghost" size="icon" onClick={startOver} disabled={busy} aria-label="Start a new preview"><Plus size={20} /></Button>}
        <Button variant="ghost" size="icon" onClick={openHelp} aria-label="About Pico"><MoreHorizontal size={22} /></Button>
      </div>
    </header>
    <main className="workspace">
      {!plan && !busy && !error && <h1 className="empty-heading">What would you like to make?</h1>}
      {(plan || busy || error) && <section className="preview-panel" aria-label="Generated interface">
        <h1 className="sr-only">Your interface</h1>
        {lastPrompt && <button className="request-bubble" onClick={() => historyDialog.current?.showModal()} aria-label="View chat"><span>{lastPrompt}</span></button>}
        <div className="preview-stage" role="region" aria-label="Interface preview" tabIndex={0}><div className="stage-inner">
          {plan ? <Preview key={previewKey} plan={plan} content={content} busy={busy} onChange={next => { setContent(next); setResult(old => old ? { ...old, content: next } : old); }} /> : busy ? <div className="choosing-state" role="status"><LoaderCircle className="spinner" size={20} /><span>Choosing a layout…</span></div> : null}
        </div></div>
      </section>}
      <div className="composer-area">
        <div id="prompt-error" className="error-message" role="alert">{error && <><span>{error}</span><button onClick={() => void generate(prompt || lastPrompt)}>Try again</button></>}</div>
        <form className="composer" onSubmit={event => { event.preventDefault(); void generate(prompt); }}>
          <label htmlFor="prompt" className="sr-only">Describe your interface</label>
          <Textarea id="prompt" ref={input} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1200} placeholder={result ? 'What would you change?' : 'Describe your interface'} rows={1} aria-describedby={error ? 'prompt-error' : undefined} aria-invalid={error.startsWith('Describe your idea')} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void generate(prompt); } }} />
          {busy ? <Button type="button" size="icon" onClick={() => controller.current?.abort()} aria-label="Stop generation"><Square size={16} /></Button> : <Button type="submit" size="icon" aria-label="Generate interface"><ArrowUp size={21} /></Button>}
        </form>
        {!lastPrompt && !busy && <div className="examples" aria-label="Example requests">{samplePrompts.slice(0, 3).map(sample => <button key={sample.type} onClick={() => void generate(sample.prompt)}>{sample.label}<ArrowUpRight size={14} /></button>)}</div>}
        {busy && <div className="generation-status" role="status"><span className="generation-dot" />{phase === 'deciding' ? 'Choosing a layout…' : 'Generating…'}</div>}
      </div>
    </main>
    <div role="status" className="sr-only">{status}{notice ? `. ${notice}` : ''}</div>
    <dialog ref={help} className="info-dialog" onClick={event => { if (event.target === event.currentTarget) help.current?.close(); }}>
      <div className="dialog-heading"><h2>About this interface</h2><Button variant="ghost" size="icon" onClick={() => help.current?.close()} aria-label="Close about Pico"><X size={20} /></Button></div>
      <dl><dt>Layout model</dt><dd>inception/mercury-decide:free</dd><dt>Content model</dt><dd>{result?.generationModel || GENERATOR}</dd>{result && <><dt>Response time</dt><dd>Layout: {timing(result.plan.decisionMs)} · Content: {timing(result.totalMs)}</dd></>}</dl>
      <p>Built from six prebuilt shadcn layouts. Content streams in after the layout is chosen. Only free OpenRouter models are used; availability depends on provider limits.</p>
      <p>This is an interactive prototype with illustrative content. Form entries, selections and edits stay in this tab. Prompts and the current preview are sent to OpenRouter. Pico does not store conversations.</p>
      {photo && <p>Illustrative photo by <a href={photo.source} target="_blank" rel="noreferrer">{photo.author} on Unsplash</a>.</p>}
      <div className="detail-actions">{result && <Button variant="outline" onClick={download}><Download size={16} />Download data</Button>}<a href="https://github.com/kennethassogba/pico" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={14} /></a><a href="https://keff.uk/">k<sub>eff</sub><ArrowUpRight size={14} /></a></div>
      {result && <details className="data-details"><summary>Interface data</summary><pre tabIndex={0} aria-label="Interface JSON">{JSON.stringify({ view: result.plan.view, ...result.content }, null, 2)}</pre></details>}
    </dialog>
    <dialog ref={historyDialog} className="info-dialog history-dialog"><div className="dialog-heading"><h2>This chat</h2><Button variant="ghost" size="icon" onClick={() => historyDialog.current?.close()} aria-label="Close chat history"><X size={20} /></Button></div>{history.map((entry, i) => <div className={`history-entry ${entry.role}`} key={i}><strong>{entry.role === 'user' ? 'You' : 'Pico'}</strong><p>{entry.content}</p></div>)}{lastPrompt && !history.some(entry => entry.role === 'user' && entry.content === lastPrompt) && <p>{lastPrompt}</p>}</dialog>
  </div>;
}
