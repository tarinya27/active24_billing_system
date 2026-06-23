import { Bell, LogOut, Moon, Search, Sun, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = { MANAGER: 'Manager', ADMIN: 'Admin', CASHIER: 'Cashier' };

export default function Topbar({ sidebarCollapsed }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.info('Signed out');
  };

  return (
    <header
      className={`fixed right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl transition-all duration-300 dark:border-slate-700/60 dark:bg-slate-900/80 sm:px-6 ${sidebarCollapsed ? 'left-[72px]' : 'left-64'}`}
    >
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search products, invoices, orders..."
          className="input-field pl-10 !py-2"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          title="Toggle theme"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <button className="relative rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
        </button>

        <div className="hidden items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/50 px-3 py-1.5 dark:border-slate-700/60 dark:bg-slate-800/50 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400">
            <User className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800 dark:text-white">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-500">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
