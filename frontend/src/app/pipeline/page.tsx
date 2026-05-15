'use client';

import React, { useState, useEffect } from 'react';
import PipelineBuilder from '@/components/PipelineBuilder';
import CollaborationPanel from '@/components/CollaborationPanel';

export default function PipelinePage() {
  const [fileId, setFileId] = useState<string | undefined>();
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('file_id');
    if (id) {
      setFileId(id);
      setUploadedFile(id);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Pipeline Builder</h1>

        {!uploadedFile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
            <p className="text-yellow-800">
              ⚠️ Please upload a file from the dashboard first to build a pipeline.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PipelineBuilder fileId={fileId} />
          </div>
          <div>
            <CollaborationPanel
              resourceType="pipeline"
              resourceId={fileId || 'default'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
