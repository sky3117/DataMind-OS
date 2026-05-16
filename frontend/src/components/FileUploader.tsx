'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadFile } from '@/lib/api';
import { useGlobalContext } from '@/context/GlobalContext';
import type { UploadResponse } from '@/types';
import { clsx } from 'clsx';

interface FileUploaderProps {
  onUpload?: (response: UploadResponse) => void;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { setFileId, setFilename, setUploadedFiles, uploadedFiles, addNotification } = useGlobalContext();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setSuccess(null);
      setUploading(true);

      try {
        const response = await uploadFile(file);
        
        // Save to global context
        setFileId(response.file_id);
        setFilename(response.filename);
        
        // Add to uploaded files list
        const newFile = {
          file_id: response.file_id,
          filename: response.filename,
          size_bytes: response.size_bytes,
          created_at: new Date().toISOString(),
        };
        
        // Keep last 50 files
        const updatedFiles = [newFile, ...uploadedFiles].slice(0, 50);
        setUploadedFiles(updatedFiles);
        
        setSuccess(`"${response.filename}" uploaded successfully`);
        addNotification(`Successfully uploaded ${response.filename}`, 'success');
        
        if (onUpload) {
          onUpload(response);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        addNotification(message, 'error');
      } finally {
        setUploading(false);
      }
    },
    [onUpload, setFileId, setFilename, setUploadedFiles, uploadedFiles, addNotification]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={clsx(
          'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300',
          'bg-slate-900/50 hover:bg-slate-800/50',
          isDragActive && !isDragReject && 'border-indigo-500 bg-indigo-950/30 scale-[1.01]',
          isDragReject && 'border-red-500 bg-red-950/20',
          !isDragActive && !isDragReject && 'border-slate-600 hover:border-indigo-500',
          uploading && 'opacity-60 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          ) : isDragReject ? (
            <AlertCircle className="w-12 h-12 text-red-400" />
          ) : isDragActive ? (
            <FileText className="w-12 h-12 text-indigo-400" />
          ) : (
            <Upload className="w-12 h-12 text-slate-400" />
          )}

          <div>
            {uploading ? (
              <p className="text-lg font-medium text-slate-300">Uploading…</p>
            ) : isDragReject ? (
              <p className="text-lg font-medium text-red-400">File type not supported</p>
            ) : isDragActive ? (
              <p className="text-lg font-medium text-indigo-300">Drop it here!</p>
            ) : (
              <>
                <p className="text-lg font-medium text-slate-300">
                  Drag &amp; drop your file here
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  or{' '}
                  <span className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    browse files
                  </span>
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-2">
            {['CSV', 'XLSX', 'XLS'].map((ext) => (
              <span
                key={ext}
                className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-400 border border-slate-700"
              >
                {ext}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-600">Max file size: 50 MB</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-400 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-center gap-2 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-400 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}
    </div>
  );
}
