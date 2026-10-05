'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFavorites } from '../store/favorites';
import { useSettings } from '../store/settings';
import OfferCard from '../components/OfferCard';

export default function FavoritesPage() {
  const favorites = useFavorites((state) => state.favorites);
  const clearFavorites = useFavorites((state) => state.clearFavorites);
  const viewMode = useSettings((state) => state.viewMode);
  const setViewMode = useSettings((state) => state.setViewMode);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return favorites;
    const term = filter.trim().toLowerCase();
    return favorites.filter(
      (item) =>
        item.title.toLowerCase().includes(term) || item.vendorName.toLowerCase().includes(term),
    );
  }, [favorites, filter]);

  if (favorites.length === 0) {
    return (
      <div className="page-narrow">
        <h1 className="page-title">کالاهای نشان‌شده</h1>
        <div className="card stack" style={{ textAlign: 'center', padding: '36px 16px' }}>
          <b style={{ fontSize: '16px' }}>هیچ کالایی نشان نشده است</b>
          <p className="muted" style={{ margin: 0 }}>
            روی علامت قلب ♡ هر کالا در فهرست تخفیف‌ها یا جستجو بزن تا به این فهرست اضافه شود و
            سریع‌تر به آن دسترسی داشته باشی.
          </p>
          <div>
            <Link className="button button--primary" href="/" style={{ marginTop: 8 }}>
              مشاهدهٔ تخفیف‌ها و جستجو
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="feed-status" style={{ marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          کالاهای نشان‌شده ({favorites.length})
        </h1>
        <button
          type="button"
          className="button"
          style={{ fontSize: '12px' }}
          onClick={() => {
            if (confirm('آیا همهٔ کالاهای نشان‌شده پاک شوند؟')) {
              clearFavorites();
            }
          }}
        >
          پاک کردن همه
        </button>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={filter}
          placeholder="فیلتر در نشان‌شده‌ها…"
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '13px',
          }}
        />

        <div className="segmented" role="radiogroup" aria-label="حالت نمایش">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            title="نمایش شبکه‌ای"
          >
            ▦
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'compact'}
            onClick={() => setViewMode('compact')}
            title="نمایش فشرده"
          >
            ☰
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">کالایی با این عنوان پیدا نشد.</p>
      ) : (
        <div className={viewMode === 'compact' ? 'offer-grid offer-grid--compact' : 'offer-grid'}>
          {filtered.map((item) => (
            <OfferCard key={item.id} offer={item.offer} />
          ))}
        </div>
      )}
    </>
  );
}
