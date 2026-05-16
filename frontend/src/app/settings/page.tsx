'use client';

import React, { useState } from 'react';
import { Settings as SettingsIcon, Moon, Bell, Users } from 'lucide-react';

export default function SettingsPage() {
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-indigo-400" />
            Settings
          </h1>
          <p className="text-slate-400">Customize your DataMind OS experience</p>
        </div>

        <div className="space-y-6">
          {/* Theme Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Moon className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100">Appearance</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-slate-300">Dark Mode (Recommended)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-slate-300">Light Mode</span>
              </label>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300">Enable notifications</span>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Collaboration Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100">Collaboration</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" defaultChecked />
                <span className="text-slate-300">Allow others to mention me</span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
