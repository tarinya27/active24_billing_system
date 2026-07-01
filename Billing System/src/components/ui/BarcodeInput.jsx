import { Scan, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

export default function BarcodeInput({
  value: controlledValue,
  onChange,
  onScan,
  placeholder = 'Enter or scan barcode...',
  className = '',
  inputClassName = '',
  clearOnScan = false,
}) {
  const [internalValue, setInternalValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const setValue = (next) => {
    if (isControlled) onChange?.(next);
    else setInternalValue(next);
  };

  const commitBarcode = () => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      toast.warning('Please enter a barcode');
      return;
    }
    onScan?.(trimmed);
    if (isControlled) onChange?.(trimmed);
    if (clearOnScan) setValue('');
  };

  const handleScan = () => {
    setScanning(true);
    commitBarcode();
    setScanning(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`input-field pl-10 font-mono text-sm ${inputClassName}`}
          autoComplete="off"
        />
      </div>
      <button type="button" onClick={handleScan} disabled={scanning} className="btn-primary whitespace-nowrap">
        <Scan className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
        {scanning ? 'Scanning...' : 'Scan'}
      </button>
    </div>
  );
}
