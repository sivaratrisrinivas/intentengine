import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import Papa from 'papaparse';

interface FileUploadProps {
  onUpload: (domains: string[]) => void;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = (file: File) => {
    setFile(file);
    setError(null);

    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        // Assuming first column is domain, or we just flatten and find domains
        const domains = data
          .flat()
          .filter((cell) => cell && typeof cell === 'string' && cell.includes('.'))
          .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]);
        
        const uniqueDomains = Array.from(new Set(domains)).filter(Boolean);

        if (uniqueDomains.length === 0) {
          setError('No valid domains found in CSV.');
          setFile(null);
          return;
        }

        onUpload(uniqueDomains);
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
        setFile(null);
      },
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        processFile(droppedFile);
      } else {
        setError('Please upload a valid CSV file.');
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50'
            : file
            ? 'border-emerald-500 bg-emerald-50/30'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center space-y-4">
          {file ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center text-emerald-600"
            >
              <CheckCircle2 className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500 mt-1">Processing domains...</p>
            </motion.div>
          ) : (
            <>
              <motion.div
                animate={{ y: isDragging ? -5 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <UploadCloud className={`w-12 h-12 mb-3 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
              </motion.div>
              <div className="space-y-1">
                <p className="text-lg font-medium text-slate-900">
                  Drop your CSV here
                </p>
                <p className="text-sm text-slate-500">
                  or click to browse from your computer
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1.5 rounded-full">
                <FileText className="w-3 h-3" />
                <span>domains.csv</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 text-sm text-red-500 text-center font-medium"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
