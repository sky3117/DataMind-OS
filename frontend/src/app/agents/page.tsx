'use client';

import React, { useState, useEffect } from 'react';
import AgentsPage from '@/components/AgentsPage';

export default function AgentsPageWrapper() {
  const [fileId, setFileId] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('file_id');
    if (id) {
      setFileId(id);
    }
  }, []);

  return <AgentsPage fileId={fileId} />;
}
