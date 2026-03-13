import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Activity, Database } from 'lucide-react';

export interface SignalResult {
  domain: string;
  isHiringAI: boolean;
  pricingTier: string;
  intentScore: number;
  status: string;
  hubspotSynced?: boolean;
}

interface LiveTableProps {
  results: SignalResult[];
  statusMessage: string | null;
  isComplete: boolean;
}

export function LiveTable({ results, statusMessage, isComplete }: LiveTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto mt-12"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-500" />
          Live Extraction Stream
        </h2>
        
        <AnimatePresence mode="wait">
          {statusMessage && !isComplete && (
            <motion.div
              key={statusMessage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusMessage}
            </motion.div>
          )}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100"
            >
              <CheckCircle2 className="w-4 h-4" />
              Extraction Complete
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Hiring Signal</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pricing Tier</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Intent Score</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">CRM Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {results.length === 0 && (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Database className="w-8 h-8 opacity-20" />
                        <p>Awaiting data stream...</p>
                      </div>
                    </td>
                  </motion.tr>
                )}
                {results.map((result, idx) => (
                  <motion.tr
                    key={result.domain}
                    initial={{ opacity: 0, y: 10, backgroundColor: '#f8fafc' }}
                    animate={{ opacity: 1, y: 0, backgroundColor: '#ffffff' }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{result.domain}</span>
                        <a href={`https://${result.domain}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {result.status === 'Complete' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {result.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {result.isHiringAI ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Detected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        {result.pricingTier || '---'}
                      </span>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${result.intentScore}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              result.intentScore >= 80 ? 'bg-emerald-500' :
                              result.intentScore >= 60 ? 'bg-indigo-500' :
                              'bg-amber-500'
                            }`}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 w-8">{result.intentScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {result.hubspotSynced ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2zm4 8h-2v-6h2v6zm0-8h-2V7h2v2z" />
                          </svg>
                          Synced
                        </motion.span>
                      ) : (
                        <span className="text-slate-300 text-sm">Pending...</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
