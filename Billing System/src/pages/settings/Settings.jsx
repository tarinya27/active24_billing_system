import { Save } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'react-toastify';

const sections = [
  { id: 'general', title: 'General Settings', fields: [{ key: 'companyName', label: 'Company Name', type: 'text' }, { key: 'companyAddress', label: 'Address', type: 'textarea' }, { key: 'companyPhone', label: 'Phone', type: 'text' }, { key: 'companyEmail', label: 'Email', type: 'email' }] },
  { id: 'invoice', title: 'Invoice Preferences', fields: [{ key: 'invoicePrefix', label: 'Invoice Prefix', type: 'text' }, { key: 'defaultPaymentMethod', label: 'Default Payment Method', type: 'select', options: ['Cash', 'Card', 'Bank Transfer', 'Credit'] }, { key: 'autoPrint', label: 'Auto Print After Invoice', type: 'toggle' }] },
  { id: 'vat', title: 'VAT Settings', fields: [{ key: 'vatEnabled', label: 'Enable VAT', type: 'toggle' }, { key: 'vatRate', label: 'VAT Rate (%)', type: 'number', readOnly: true }] },
  { id: 'user', title: 'User Preferences', fields: [{ key: 'notificationsEnabled', label: 'Enable Notifications', type: 'toggle' }, { key: 'lowStockThreshold', label: 'Low Stock Threshold', type: 'number' }] },
];

export default function Settings() {
  const { settings, setSettings } = useApp();
  const { theme, setTheme } = useTheme();

  const handleChange = (key, value) => setSettings({ ...settings, [key]: value });

  const handleSave = () => toast.success('Settings saved successfully (mock state)');

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure system preferences" actions={<button onClick={handleSave} className="btn-primary"><Save className="h-4 w-4" /> Save Changes</button>} />

      <div className="mb-6 glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold">Theme Preferences</h3>
        <div className="flex gap-3">
          {['light', 'dark'].map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={`rounded-xl border-2 px-6 py-4 text-sm font-medium capitalize transition-all ${theme === t ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'}`}>
              {t} Mode
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.id} className="glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{section.title}</h3>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-400">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea value={settings[field.key]} onChange={(e) => handleChange(field.key, e.target.value)} rows={2} className="input-field" />
                  ) : field.type === 'select' ? (
                    <select value={settings[field.key]} onChange={(e) => handleChange(field.key, e.target.value)} className="select-field">
                      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'toggle' ? (
                    <button type="button" onClick={() => handleChange(field.key, !settings[field.key])} className={`relative h-7 w-12 rounded-full transition-colors ${settings[field.key] ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${settings[field.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  ) : (
                    <input type={field.type} value={settings[field.key]} onChange={(e) => handleChange(field.key, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)} readOnly={field.readOnly} className={`input-field ${field.readOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
                  )}
                  {field.readOnly && <p className="mt-1 text-[10px] text-slate-400">Read-only — configurable in future phases</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
