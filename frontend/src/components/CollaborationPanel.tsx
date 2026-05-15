'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, Share2, Activity, Send } from 'lucide-react';

interface CollaborationPanelProps {
  resourceType?: string;
  resourceId?: string;
}

export default function CollaborationPanel({
  resourceType = 'pipeline',
  resourceId = 'default',
}: CollaborationPanelProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'share'>(
    'comments'
  );
  const [loading, setLoading] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  useEffect(() => {
    loadComments();
    loadActivities();
  }, [resourceId]);

  const loadComments = async () => {
    try {
      const { getComments } = await import('@/lib/api');
      const result = await getComments(resourceType, resourceId);
      setComments(result.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const { getActivities } = await import('@/lib/api');
      const result = await getActivities(resourceType, resourceId, 20);
      setActivities(result.activities || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const { addComment } = await import('@/lib/api');
      await addComment(resourceType, resourceId, 'current-user', newComment);
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment');
    }
  };

  const shareResource = async () => {
    if (sharedWith.length === 0) {
      alert('Please enter at least one email');
      return;
    }

    try {
      const { shareResource } = await import('@/lib/api');
      await shareResource(resourceType, resourceId, 'current-user', sharedWith);
      setSharedWith([]);
      alert('Resource shared successfully!');
    } catch (error) {
      console.error('Failed to share resource:', error);
      alert('Failed to share resource');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users size={20} />
          Collaboration
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('comments')}
            className={`p-2 rounded hover:bg-gray-100 ${
              activeTab === 'comments' ? 'bg-blue-100 text-blue-600' : ''
            }`}
            title="Comments"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`p-2 rounded hover:bg-gray-100 ${
              activeTab === 'activity' ? 'bg-blue-100 text-blue-600' : ''
            }`}
            title="Activity"
          >
            <Activity size={18} />
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`p-2 rounded hover:bg-gray-100 ${
              activeTab === 'share' ? 'bg-blue-100 text-blue-600' : ''
            }`}
            title="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No comments yet
                </p>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment.id} className="bg-gray-50 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{comment.author}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </div>
                      {comment.resolved && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-2">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No activities yet
              </p>
            ) : (
              activities.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{activity.user}</p>
                    <p className="text-gray-600">
                      {activity.action} {activity.resource_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'share' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Share with (emails)
              </label>
              <input
                type="text"
                placeholder="user@example.com, other@example.com"
                onChange={(e) =>
                  setSharedWith(
                    e.target.value.split(',').map((s) => s.trim())
                  )
                }
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <button
              onClick={shareResource}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Share Resource
            </button>
          </div>
        )}
      </div>

      {activeTab === 'comments' && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addComment()}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border rounded text-sm"
            />
            <button
              onClick={addComment}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
