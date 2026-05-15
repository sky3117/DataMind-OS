const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadFile(file: File): Promise<import('@/types').UploadResponse> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }

  return res.json();
}

export async function getProfile(fileId: string): Promise<import('@/types').ProfileResponse> {
  const res = await fetch(`${API_BASE}/api/profile/${fileId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Profile fetch failed');
  }

  return res.json();
}

export async function getDashboard(fileId: string): Promise<import('@/types').DashboardResponse> {
  const res = await fetch(`${API_BASE}/api/dashboard/${fileId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Dashboard fetch failed');
  }

  return res.json();
}

export async function* streamChat(
  fileId: string,
  question: string
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Chat request failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            content?: string;
            done?: boolean;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.done) return;
          if (parsed.content) yield parsed.content;
        } catch (e) {
          if (e instanceof Error && e.message !== raw) throw e;
        }
      }
    }
  }
}
