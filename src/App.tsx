import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import { Play, Check, Loader2, ExternalLink, AlertCircle, ChevronDown, ChevronUp, Info, RefreshCw, Home, X } from 'lucide-react';

const DEFAULT_DOMAINS = [
  'stripe.com',
  'linear.app',
  'vercel.com',
  'openai.com',
  'anthropic.com',
];

type Status = 'idle' | 'running' | 'complete';

interface DomainResult {
  domain: string;
  status: 'pending' | 'connecting' | 'extracting' | 'scoring' | 'synced';
  isHiringAI?: boolean;
  pricingTier?: string;
  intentScore?: number;
  errors?: string[];
  scrapedTextSnippet?: string;
  aiRawResponse?: string;
  engineeringRoles?: string[];
  aiRoleTitles?: string[];
  numEngineeringRoles?: number;
  hasEnterpriseTier?: boolean;
  requiresSalesContact?: boolean;
  tiers?: string[];
   summary?: string;
  hasAIHero?: boolean;
  mentionsLLMOrAgents?: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<DomainResult[]>([]);
  const [activeStep, setActiveStep] = useState<string>('');
  const [inputText, setInputText] = useState<string>(DEFAULT_DOMAINS.join('\n'));
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const selectedResult = expandedDomain
    ? results.find((r) => r.domain === expandedDomain) || null
    : null;

  const boolLabel = (v: boolean | undefined) => (v === undefined ? '--' : v ? 'Yes' : 'No');

  const runSimulation = () => {
    const domains = inputText.split('\n').map(d => d.trim()).filter(Boolean);
    if (domains.length === 0) return;

    setStatus('running');
    setExpandedDomain(null);
    setResults(domains.map(d => ({ domain: d, status: 'pending' })));
    setActiveStep('Initializing engine...');

    const url = `/api/stream?domains=${encodeURIComponent(domains.join(','))}`;
    const source = new EventSource(url);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setActiveStep(data.message);
      } else if (data.type === 'progress') {
        setResults((prev) =>
          prev.map((r) =>
            r.domain === data.domain ? { ...r, status: data.status } : r
          )
        );
      } else if (data.type === 'result') {
        setResults((prev) =>
          prev.map((r) =>
            r.domain === data.data.domain ? { ...r, ...data.data } : r
          )
        );
      } else if (data.type === 'hubspot_sync') {
        setResults((prev) =>
          prev.map((r) =>
            r.domain === data.domain ? { 
              ...r, 
              status: 'synced',
              errors: data.success ? r.errors : [...(r.errors || []), `HubSpot Sync Failed: ${data.error}`]
            } : r
          )
        );
      } else if (data.type === 'complete') {
        setStatus('complete');
        setActiveStep('');
        source.close();
      } else if (data.type === 'error') {
        setActiveStep(`Error: ${data.message}`);
        source.close();
      }
    };

    source.onerror = () => {
      setActiveStep('Connection lost. Reconnecting...');
      source.close();
    };
  };

  const reset = () => {
    setStatus('idle');
    setResults([]);
    setExpandedDomain(null);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-grid font-sans text-brand-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Header / Logo Area */}
      <div className="absolute top-8 left-8 flex items-center gap-3 cursor-pointer" onClick={reset}>
        <div className="w-8 h-8 border border-brand-border bg-white flex items-center justify-center font-bold text-sm">
          IE
        </div>
        <span className="font-semibold tracking-tight">Intent Engine</span>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center max-w-2xl z-10 w-full"
          >
            <div className="mb-8 relative inline-block">
               {/* Isometric block placeholder */}
               <motion.div 
                 className="w-24 h-24 mx-auto relative"
                 animate={{ y: [0, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
               >
                 <div className="absolute inset-0 bg-brand-orange transform rotate-45 skew-x-12 skew-y-12 shadow-2xl"></div>
                 <div className="absolute inset-0 bg-brand-orange/80 transform rotate-45 -skew-x-12 -skew-y-12 translate-y-4 shadow-xl"></div>
                 <div className="absolute inset-0 bg-brand-orange/60 transform rotate-45 translate-x-4 -translate-y-4"></div>
               </motion.div>
            </div>
            
            <h1 className="text-6xl font-bold tracking-tighter mb-6 leading-tight">
              We help Sales use the web.
            </h1>
            <p className="text-xl text-gray-500 mb-10 font-medium">
              Autonomously read, extract, and score GTM intent with headless browsers.
            </p>

            <div className="bg-white border border-brand-border p-4 mb-8 text-left shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Target Domains (One per line)</label>
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-32 p-3 font-mono text-sm border border-gray-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none resize-none"
                placeholder="stripe.com&#10;linear.app"
              />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={runSimulation}
                className="bg-brand-orange hover:bg-[#d93a15] text-white px-8 py-4 font-semibold text-lg transition-colors flex items-center gap-2 group shadow-lg"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Run Engine
              </button>
            </div>
          </motion.div>
        )}

        {(status === 'running' || status === 'complete') && (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl z-10 pb-24"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold tracking-tight mb-4 flex items-center justify-center gap-3">
                {status === 'complete' ? (
                  <><Check className="w-8 h-8 text-emerald-500" /> Extraction Complete</>
                ) : (
                  'Live Extraction'
                )}
              </h2>
              <div className="h-6 flex items-center justify-center text-brand-orange font-mono text-sm">
                {activeStep && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    {status !== 'complete' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {activeStep}
                  </motion.div>
                )}
              </div>
            </div>

            {status !== 'complete' ? (
              <div className="grid gap-4">
                <AnimatePresence>
                  {results.map((result, idx) => (
                  <motion.div
                    key={result.domain}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`bg-white border shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${result.status !== 'pending' && result.status !== 'synced' ? 'border-brand-orange' : 'border-brand-border'}`}
                  >
                    {/* Scanning animation line */}
                    {result.status !== 'pending' && result.status !== 'synced' && (
                      <motion.div 
                        className="absolute inset-y-0 left-0 w-1 bg-brand-orange"
                        layoutId="active-scanner"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    )}
                    
                    {/* Background pulse when active */}
                    {result.status !== 'pending' && result.status !== 'synced' && (
                      <motion.div 
                        className="absolute inset-0 bg-brand-orange/5 pointer-events-none"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}

                    <div 
                      className="p-6 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedDomain(expandedDomain === result.domain ? null : result.domain)}
                    >
                      <div className="flex items-center gap-6 w-1/3 relative z-10">
                        <div className="w-8 h-8 bg-gray-50 border border-brand-border flex items-center justify-center text-xs font-mono text-gray-400">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {result.domain}
                            <a href={`https://${result.domain}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                              <ExternalLink className="w-4 h-4 text-gray-300 hover:text-brand-orange transition-colors" />
                            </a>
                          </div>
                          <div className="text-sm text-gray-500 font-mono mt-1 flex items-center gap-2">
                            {result.status === 'pending' && <span className="text-gray-400">Queued...</span>}
                            {result.status === 'connecting' && <><Loader2 className="w-3 h-3 animate-spin text-brand-orange"/> Spinning up secure stealth browsers...</>}
                            {result.status === 'extracting' && <><Loader2 className="w-3 h-3 animate-spin text-brand-orange"/> Bypassing Cloudflare & extracting...</>}
                            {result.status === 'scoring' && <><Loader2 className="w-3 h-3 animate-spin text-brand-orange"/> Compiling weighted Intent Score...</>}
                            {result.status === 'synced' && <><Check className="w-3 h-3 text-emerald-500"/> Piped to HubSpot CRM</>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 w-2/3 justify-end relative z-10">
                        {/* Errors Warning */}
                        {result.errors && result.errors.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 text-xs font-medium border border-amber-200 cursor-help" 
                            title={result.errors.join('\n')}
                          >
                            <AlertCircle className="w-4 h-4" />
                            <span>{result.errors.length} Warnings</span>
                          </motion.div>
                        )}

                        {/* Signals */}
                        <div className="flex flex-col gap-2 min-w-[100px]">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Hiring</div>
                          <div className="font-mono text-sm">
                            {result.isHiringAI === undefined ? (
                              <span className="text-gray-300">--</span>
                            ) : result.isHiringAI ? (
                              <motion.span 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-emerald-600 font-medium flex items-center gap-1"
                              >
                                <Check className="w-3 h-3"/> True
                              </motion.span>
                            ) : (
                              <motion.span 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-gray-500"
                              >
                                False
                              </motion.span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[100px]">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pricing</div>
                          <div className="font-mono text-sm">
                            {result.pricingTier ? (
                              <motion.span
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                              >
                                {result.pricingTier}
                              </motion.span>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[80px] items-end">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Intent</div>
                          <div className="font-mono text-2xl font-bold text-brand-black">
                            {result.intentScore !== undefined ? (
                              <motion.span
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={result.intentScore > 80 ? 'text-brand-orange' : ''}
                              >
                                <AnimatedNumber value={result.intentScore} />
                              </motion.span>
                            ) : (
                              <span className="text-gray-200">00</span>
                            )}
                          </div>
                          {result.summary && (
                            <div className="mt-1 max-w-xs text-right text-[11px] text-gray-500 leading-snug">
                              {result.summary}
                            </div>
                          )}
                        </div>

                        <div className="text-gray-400 ml-4">
                          {expandedDomain === result.domain ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                  </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="bg-white border border-brand-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accounts</div>
                    <div className="text-lg font-semibold tracking-tight">
                      {results.length} processed
                    </div>
                  </div>
                  <div className="text-xs font-mono text-gray-400">
                    Click a row for details
                  </div>
                </div>

                <div className="grid grid-cols-[44px_1.5fr_0.8fr_0.8fr_0.8fr_32px] gap-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 px-6 py-3">
                  <div>#</div>
                  <div>Company</div>
                  <div>AI Hiring</div>
                  <div>Pricing</div>
                  <div className="text-right">Intent</div>
                  <div />
                </div>

                <div className="divide-y divide-gray-100">
                  {results.map((r, idx) => (
                    <button
                      key={r.domain}
                      onClick={() => setExpandedDomain(r.domain)}
                      className="w-full text-left px-6 py-4 grid grid-cols-[44px_1.5fr_0.8fr_0.8fr_0.8fr_32px] items-center hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-50 border border-brand-border flex items-center justify-center text-xs font-mono text-gray-400">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm truncate">{r.domain}</div>
                          <a
                            href={`https://${r.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-300 hover:text-brand-orange transition-colors" />
                          </a>
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-1 flex items-center gap-2">
                          {r.status === 'synced' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" /> Piped to HubSpot CRM
                            </>
                          ) : (
                            <span className="text-gray-400">Complete</span>
                          )}
                          {r.errors && r.errors.length > 0 && (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
                              {r.errors.length} warnings
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-mono text-sm text-gray-600">
                        {r.isHiringAI === undefined ? '--' : r.isHiringAI ? (
                          <span className="text-emerald-700 font-medium">True</span>
                        ) : (
                          <span className="text-gray-500">False</span>
                        )}
                      </div>
                      <div className="font-mono text-sm text-gray-600">
                        {r.pricingTier || <span className="text-gray-300">--</span>}
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-2xl font-bold ${r.intentScore !== undefined && r.intentScore > 80 ? 'text-brand-orange' : 'text-brand-black'}`}>
                          {r.intentScore !== undefined ? <AnimatedNumber value={r.intentScore} /> : '00'}
                        </div>
                        {r.summary && (
                          <div className="mt-1 text-[11px] text-gray-500 leading-snug">
                            {r.summary}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-300 flex justify-end">
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Details Drawer (complete screen) */}
            <AnimatePresence>
              {status === 'complete' && selectedResult && (
                <>
                  <motion.button
                    type="button"
                    className="fixed inset-0 bg-black/20 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setExpandedDomain(null)}
                    aria-label="Close details"
                  />
                  <motion.aside
                    className="fixed right-0 top-0 h-screen w-full max-w-[520px] bg-white z-50 border-l border-brand-border shadow-2xl flex flex-col"
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 40, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                  >
                    <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="text-xl font-semibold tracking-tight truncate">{selectedResult.domain}</div>
                          <a
                            href={`https://${selectedResult.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-300 hover:text-brand-orange transition-colors" />
                          </a>
                        </div>
                        {selectedResult.summary && (
                          <div className="mt-2 text-sm text-gray-600 leading-snug">
                            {selectedResult.summary}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedDomain(null)}
                        className="w-10 h-10 border border-brand-border bg-white hover:bg-gray-50 flex items-center justify-center"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    <div className="px-6 py-5 border-b border-gray-100 grid grid-cols-3 gap-4">
                      <div className="border border-gray-100 bg-gray-50 p-3">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Intent</div>
                        <div className="mt-1 font-mono text-3xl font-bold text-brand-black">
                          {selectedResult.intentScore ?? 0}
                        </div>
                      </div>
                      <div className="border border-gray-100 bg-gray-50 p-3">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">AI Hero</div>
                        <div className="mt-1 font-mono text-lg text-gray-700">{boolLabel(selectedResult.hasAIHero)}</div>
                      </div>
                      <div className="border border-gray-100 bg-gray-50 p-3">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">LLM/Agents</div>
                        <div className="mt-1 font-mono text-lg text-gray-700">{boolLabel(selectedResult.mentionsLLMOrAgents)}</div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                      <section>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Signals</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="border border-gray-100 p-3">
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">AI Hiring</div>
                            <div className="mt-1 font-mono">{boolLabel(selectedResult.isHiringAI)}</div>
                          </div>
                          <div className="border border-gray-100 p-3">
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Enterprise Tier</div>
                            <div className="mt-1 font-mono">{boolLabel(selectedResult.hasEnterpriseTier)}</div>
                          </div>
                          <div className="border border-gray-100 p-3">
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sales Contact</div>
                            <div className="mt-1 font-mono">{boolLabel(selectedResult.requiresSalesContact)}</div>
                          </div>
                          <div className="border border-gray-100 p-3">
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Eng Roles</div>
                            <div className="mt-1 font-mono">{selectedResult.numEngineeringRoles ?? 0}</div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI-related roles</div>
                        {selectedResult.aiRoleTitles && selectedResult.aiRoleTitles.length > 0 ? (
                          <ul className="space-y-2">
                            {selectedResult.aiRoleTitles.map((t) => (
                              <li key={t} className="border border-gray-100 p-3 text-sm">
                                {t}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="border border-gray-100 p-3 text-sm text-gray-400 italic">
                            None extracted.
                          </div>
                        )}
                      </section>

                      <section>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pricing tiers</div>
                        {selectedResult.tiers && selectedResult.tiers.length > 0 ? (
                          <div className="border border-gray-100 p-3 text-sm text-gray-700">
                            {selectedResult.tiers.join(' → ')}
                          </div>
                        ) : (
                          <div className="border border-gray-100 p-3 text-sm text-gray-400 italic">
                            None extracted.
                          </div>
                        )}
                      </section>

                      <section>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Scraped snippet</div>
                        <div className="border border-gray-100 p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {selectedResult.scrapedTextSnippet || '—'}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Raw extraction JSON</div>
                        <div className="border border-gray-100 p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {selectedResult.aiRawResponse || '—'}
                        </div>
                      </section>
                    </div>
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            {status === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 flex items-center justify-center gap-4"
              >
                <button
                  onClick={reset}
                  className="bg-brand-black hover:bg-gray-800 text-white px-8 py-4 font-semibold text-lg transition-colors flex items-center gap-3 shadow-lg rounded-md"
                >
                  <Home className="w-5 h-5" />
                  Back to Home
                </button>
                <button
                  onClick={() => {
                    reset();
                    setTimeout(runSimulation, 100);
                  }}
                  className="bg-white border-2 border-brand-black hover:bg-gray-50 text-brand-black px-8 py-4 font-semibold text-lg transition-colors flex items-center gap-3 shadow-lg rounded-md"
                >
                  <RefreshCw className="w-5 h-5" />
                  Run Another Batch
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
