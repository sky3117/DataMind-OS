'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, MessageSquare, Share2, Activity, Send, Wifi, WifiOff } from 'lucide-react';
import { WS_BASE_URL } from '@/lib/config';

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
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = `${WS_BASE_URL}/api/ws/collaboration/${resourceId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'comment') {
            setComments((prev) => [...prev, data.data]);
          } else if (data.type === 'activity') {
            setActivities((prev) => [data.data, ...prev]);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [resourceId]);

  const loadComments = useCallback(async () => {
    try {
      const { getComments } = await import('@/lib/api');
      const result = await getComments(resourceType, resourceId);
      setComments(result.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, [resourceType, resourceId]);

  const loadActivities = useCallback(async () => {
    try {
      const { getActivities } = await import('@/lib/api');
      const result = await getActivities(resourceType, resourceId, 20);
      setActivities(result.activities || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    loadComments();
    loadActivities();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [resourceId, loadComments, loadActivities, connectWebSocket]);

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const { addComment } = await import('@/lib/api');
      await addComment(resourceType, resourceId, 'current-user', newComment);
      setNewComment('');
      await loadComments();
      
      // Broadcast via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'comment',
          data: { author: 'current-user', content: newComment, created_at: new Date().toISOString() },
        }));
      }
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
    <div className="flex h-full flex-col rounded-xl border border-cyan-500/20 bg-slate-900/75 shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-700/80 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Users size={20} />
          Collaboration
          <div
            className={isConnected ? 'text-emerald-400' : 'text-slate-500'}
            title={isConnected ? 'Connected' : 'Disconnected'}
          >
            {isConnected ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}
          </div>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('comments')}
            className={`rounded-lg p-2 transition-all hover:bg-slate-800 ${
              activeTab === 'comments' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
            }`}
            title="Comments"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`rounded-lg p-2 transition-all hover:bg-slate-800 ${
              activeTab === 'activity' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
            }`}
            title="Activity"
          >
            <Activity size={18} />
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`rounded-lg p-2 transition-all hover:bg-slate-800 ${
              activeTab === 'share' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
            }`}
            title="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-slate-200">
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {comments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">
                    No comments yet
                  </p>
                ) : (
                  comments.map((comment: any) => (
                    <div key={comment.id} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{comment.author}</p>
                          <p className="text-xs text-slate-400">
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
                  <p className="py-4 text-center text-sm text-slate-400">
                    No activities yet
                  </p>
                ) : (
                  activities.map((activity: any) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400" />
                      <div>
                        <p className="font-medium text-slate-200">{activity.user}</p>
                        <p className="text-slate-300">
                          {activity.action} {activity.resource_type}
                        </p>
                        <p className="text-xs text-slate-400">
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
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <button
              onClick={shareResource}
              className="w-full rounded bg-cyan-600 px-4 py-2 text-sm text-white transition-colors hover:bg-cyan-500"
            >
              Share Resource
            </button>
          </div>
        )}
      </div>

      {activeTab === 'comments' && (
        <div className="border-t border-slate-700 bg-slate-900/80 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addComment()}
              placeholder="Add a comment..."
              className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              onClick={addComment}
              className="rounded bg-cyan-600 px-3 py-2 text-white transition-colors hover:bg-cyan-500"
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
