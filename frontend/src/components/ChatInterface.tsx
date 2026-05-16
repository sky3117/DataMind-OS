'use client';

import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';
import type { ChatMessage } from '@/types';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInterfaceProps {
  fileId: string;
  filename?: string;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={clsx(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-indigo-600' : 'bg-slate-700'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-indigo-300" />
        )}
      </div>

      <div className={clsx(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
      )}>
        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
        <p className={clsx(
          'text-xs mt-1',
          isUser ? 'text-indigo-200/70' : 'text-slate-500'
        )}>
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'What are the key insights from this dataset?',
  'Identify any data quality issues or anomalies.',
  'What correlations exist between the columns?',
  'Summarize the distribution of numeric columns.',
];

export default function ChatInterface({ fileId, filename }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || streaming) return;

    setError(null);
    const userMsg: ChatMessage = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          question: question.trim(),
          message: question.trim(),
          chat_history: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const detail = typeof errorData === 'object' && errorData !== null && 'detail' in errorData
          ? String(errorData.detail)
          : `Chat request failed with status ${response.status}`;
        throw new Error(detail);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const data = JSON.parse(raw) as { content?: string; error?: string; done?: boolean };

            if (data.error) {
              streamError = data.error;
              break;
            }

            if (data.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data.content };
                }
                return updated;
              });
            }

            if (data.done) {
              break;
            }
          } catch {
            continue;
          }
        }

        if (streamError) {
          break;
        }
      }

      if (!streamError && buffer.trim().startsWith('data: ')) {
        const raw = buffer.trim().slice(6).trim();
        if (raw) {
          try {
            const data = JSON.parse(raw) as { content?: string; error?: string };
            if (data.error) {
              streamError = data.error;
            } else if (data.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data.content };
                }
                return updated;
              });
            }
          } catch {
            // Ignore invalid trailing payload
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <div>
          <p className="text-sm font-semibold text-slate-200">AI Data Analyst</p>
          {filename && <p className="text-xs text-slate-500">{filename}</p>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-500">Claude</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-6 pt-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-800/50 flex items-center justify-center">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-300 font-medium">Ask me anything about your data</p>
              <p className="text-slate-500 text-sm mt-1">
                I can analyze patterns, spot anomalies, and provide insights.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mb-3 flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-800/50 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 border-t border-slate-800 bg-slate-900">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your data… (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors max-h-32 overflow-y-auto"
            style={{ minHeight: '48px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className={clsx(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
              input.trim() && !streaming
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            )}
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  );
}
