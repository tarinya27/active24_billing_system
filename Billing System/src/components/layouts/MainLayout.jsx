import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <Topbar sidebarCollapsed={sidebarCollapsed} />
      <main
        className={`min-h-screen pt-20 transition-all duration-300 ${sidebarCollapsed ? 'pl-[72px]' : 'pl-64'}`}
      >
        <div className="page-enter p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
