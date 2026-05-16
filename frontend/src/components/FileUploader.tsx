'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadFile } from '@/lib/api';
import { uploadQueue, type QueueState } from '@/lib/uploadQueue';
import { useGlobalContext } from '@/context/GlobalContext';
import type { UploadResponse } from '@/types';
import { clsx } from 'clsx';

const MAX_UPLOADED_FILES = 50;
const MAX_FILE_SIZE_MB = 50;

interface FileUploaderProps {
  onUpload?: (response: UploadResponse) => void;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const { setFileId, setFilename, setUploadedFiles, uploadedFiles, addNotification } = useGlobalContext();

  // Subscribe to queue state changes
  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe(setQueueState);
    return unsubscribe;
  }, []);

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    if (!file.name) {
      return 'File name is required';
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      return `File type '.${ext}' not allowed. Supported types: CSV, XLSX, XLS`;
    }

    if (file.size === 0) {
      return 'File is empty';
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File size must be less than ${MAX_FILE_SIZE_MB}MB. Got ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }

    return null;
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        addNotification(validationError, 'error');
        return;
      }

      setError(null);
      setSuccess(null);
      setUploadProgress(0);
      setUploading(true);

      // Create upload task with error handling and recovery
      const executeUpload = async () => {
        try {
          // Simulate progress for better UX
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => {
              if (prev >= 90) return prev;
              return prev + Math.random() * 20;
            });
          }, 200);

          const response = await uploadFile(file);
          clearInterval(progressInterval);
          setUploadProgress(100);

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

          // Keep last 50 files (prevent state corruption by using a fresh array)
          const updatedFiles = [newFile, ...uploadedFiles].slice(0, MAX_UPLOADED_FILES);
          setUploadedFiles(updatedFiles);

          setSuccess(`"${response.filename}" uploaded successfully`);
          addNotification(`Successfully uploaded ${response.filename}`, 'success');

          // Reset progress after success message
          setTimeout(() => {
            setUploadProgress(0);
          }, 2000);

          if (onUpload) {
            onUpload(response);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          setError(message);

          // Provide helpful error messages
          let userMessage = message;
          if (message.includes('timeout')) {
            userMessage = 'Upload timed out. Please try again or use a smaller file.';
          } else if (message.includes('429') || message.includes('too many')) {
            userMessage = 'Too many requests. Please wait a moment and try again.';
          } else if (message.includes('503')) {
            userMessage = 'Server is busy. Please try again in a moment.';
          }

          addNotification(userMessage, 'error');
          setUploadProgress(0);
          throw err; // Re-throw to mark task as failed in queue
        } finally {
          setUploading(false);
        }
      };

      // Add task to queue
      uploadQueue.addTask(file, executeUpload, 1);
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
    disabled: uploading || (queueState?.isProcessing ?? false),
  });

  const isDisabled = uploading || (queueState?.isProcessing ?? false);
  const queuedUploads = queueState?.queueSize ?? 0;

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
          isDisabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              <p className="text-lg font-medium text-slate-300">Uploading…</p>
              {/* Progress bar */}
              <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{Math.round(uploadProgress)}%</p>
            </>
          ) : isDragReject ? (
            <>
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-lg font-medium text-red-400">File type not supported</p>
            </>
          ) : isDragActive ? (
            <>
              <FileText className="w-12 h-12 text-indigo-400" />
              <p className="text-lg font-medium text-indigo-300">Drop it here!</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-slate-400" />
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

          <p className="text-xs text-slate-600">Max file size: {MAX_FILE_SIZE_MB} MB</p>
        </div>
      </div>

      {/* Queue info */}
      {queuedUploads > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-blue-950/30 border border-blue-800/50 text-blue-400">
          <p className="text-xs">
            {queuedUploads} file{queuedUploads === 1 ? '' : 's'} waiting in queue
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-400 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{error}</p>
          </div>
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
