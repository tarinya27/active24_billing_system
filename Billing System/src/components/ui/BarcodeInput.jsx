import { Scan, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

export default function BarcodeInput({ onScan, placeholder = 'Enter or scan barcode...' }) {
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    if (!value.trim()) {
      toast.warning('Please enter a barcode');
      return;
    }
    setScanning(true);
    setTimeout(() => {
      onScan(value.trim());
      setScanning(false);
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input-field pl-10"
        />
      </div>
      <button onClick={handleScan} disabled={scanning} className="btn-primary whitespace-nowrap">
        <Scan className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
        {scanning ? 'Scanning...' : 'Scan'}
      </button>
    </div>
  );
}
