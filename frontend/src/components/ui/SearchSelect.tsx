'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';

type Option = { value: string | number; label: string };

interface SearchSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function SearchSelect({
  label, value, onChange, options,
  placeholder = 'Seleccionar', required, disabled,
}: SearchSelectProps) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const selected = options.find(o => String(o.value) === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [close]);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const select = (opt: Option) => {
    onChange(String(opt.value));
    close();
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && filtered.length === 1) { select(filtered[0]); e.preventDefault(); }
  };

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {/* Trigger */}
        <div
          role="combobox"
          aria-expanded={open}
          onClick={openDropdown}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm bg-white transition-colors cursor-pointer
            ${open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300 hover:border-slate-400'}
            ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
        >
          {open ? (
            <input
              ref={inputRef}
              className="flex-1 outline-none bg-transparent placeholder:text-slate-400 min-w-0"
              placeholder="Buscar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className={`flex-1 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
              {selected ? selected.label : placeholder}
            </span>
          )}
          {value && !open && !disabled ? (
            <button
              type="button"
              onClick={clear}
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X size={13} />
            </button>
          ) : (
            <ChevronDown
              size={14}
              className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400 italic">Sin resultados para "{query}"</p>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => select(opt)}
                  className={`px-3 py-2 text-sm cursor-pointer select-none
                    ${String(opt.value) === value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
