'use client';

import { useGlobalContext } from '@/context/GlobalContext';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export function NotificationContainer() {
  const { notifications, removeNotification } = useGlobalContext();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-md">
      {notifications.map((notification) => {
        const iconClass = 'w-5 h-5';

        const getIcon = () => {
          switch (notification.type) {
            case 'success':
              return <CheckCircle className={clsx(iconClass, 'text-emerald-400')} />;
            case 'error':
              return <AlertCircle className={clsx(iconClass, 'text-red-400')} />;
            case 'warning':
              return <AlertCircle className={clsx(iconClass, 'text-amber-400')} />;
            case 'info':
            default:
              return <Info className={clsx(iconClass, 'text-blue-400')} />;
          }
        };

        const getColors = () => {
          switch (notification.type) {
            case 'success':
              return 'bg-emerald-950 border-emerald-800 text-emerald-100';
            case 'error':
              return 'bg-red-950 border-red-800 text-red-100';
            case 'warning':
              return 'bg-amber-950 border-amber-800 text-amber-100';
            case 'info':
            default:
              return 'bg-blue-950 border-blue-800 text-blue-100';
          }
        };

        return (
          <div
            key={notification.id}
            className={clsx(
              'flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm animate-in fade-in slide-in-from-right-4',
              getColors()
            )}
          >
            {getIcon()}
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
