import React from 'react';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
          <LayoutDashboard className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700 mb-2">대시보드</h2>
        <p className="text-sm text-slate-400">준비 중입니다.</p>
      </div>
    </div>
  );
}
