'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '../store/settings';

export default function LocationChip() {
  const { location, savedLocations, selectLocation } = useSettings();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleChipClick = () => {
    if (savedLocations.length > 1) {
      setOpen((prev) => !prev);
    } else {
      router.push('/settings');
    }
  };

  return (
    <div className="location-chip-wrapper" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`chip${location ? '' : ' warn'}`}
        onClick={handleChipClick}
        title="تغییر موقعیت تحویل"
      >
        <span aria-hidden="true">◎</span>
        {location ? location.label : 'موقعیت تنظیم نشده'}
        {savedLocations.length > 1 && (
          <span className="chip-arrow" aria-hidden="true">
            ▾
          </span>
        )}
      </button>

      {open && savedLocations.length > 0 && (
        <div className="location-menu" role="menu" aria-label="انتخاب موقعیت تحویل">
          <div className="location-menu-title">تغییر سریع موقعیت:</div>
          {savedLocations.map((loc) => {
            const isSelected =
              location &&
              loc.lat === location.lat &&
              loc.lng === location.lng &&
              loc.label === location.label;
            return (
              <button
                key={loc.id || `${loc.lat},${loc.lng}`}
                type="button"
                className={`location-menu-item${isSelected ? ' is-active' : ''}`}
                onClick={() => {
                  selectLocation(loc);
                  setOpen(false);
                }}
              >
                <b>{loc.label}</b>
                {isSelected && <span className="address-tag">فعلی</span>}
              </button>
            );
          })}
          <div className="location-menu-footer">
            <button
              type="button"
              className="button button--block"
              style={{ padding: '4px 8px', fontSize: '12px', minHeight: '32px' }}
              onClick={() => {
                setOpen(false);
                router.push('/settings');
              }}
            >
              ⚙ مدیریت و افزودن موقعیت
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
