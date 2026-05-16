'use client';

import React, { useState, useEffect } from 'react';
import CollaborationPanel from '@/components/CollaborationPanel';
import { Users, Activity } from 'lucide-react';

export default function CollaboratePage() {
  const [resourceId, setResourceId] = useState('default');
  const [resourceType, setResourceType] = useState('pipeline');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('resource_id');
    const type = params.get('resource_type');
    if (id) setResourceId(id);
    if (type) setResourceType(type);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <Users className="text-blue-600" size={32} />
            Collaboration
          </h1>
          <p className="text-gray-600">
            Work together on pipelines, datasets, and reports in real-time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Resource Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resource Type
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="pipeline">Pipeline</option>
                    <option value="dataset">Dataset</option>
                    <option value="report">Report</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resource ID
                  </label>
                  <input
                    type="text"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    placeholder="Enter resource ID"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Activity size={18} />
                  Real-time Features
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Live collaboration with team members</li>
                  <li>✓ Comments and discussions</li>
                  <li>✓ Activity tracking</li>
                  <li>✓ Resource sharing with permissions</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <CollaborationPanel resourceType={resourceType} resourceId={resourceId} />
          </div>
        </div>
      </div>
    </div>
  );
}
