'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsPage, sortByDiscount } from '../core/deals';
import { hunt } from '../core/hunt';
import * as snapp from '../api/snapp';
import { SORT_MODES } from '../core/rank';
import type { SortMode } from '../core/types';
import OfferCard from '../components/OfferCard';
import LocationPrompt from '../components/LocationPrompt';
import SignInPrompt from '../components/SignInPrompt';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';

const money = new Intl.NumberFormat('en-US');
const clock = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });

const FRESH_FOR = 5 * 60_000;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function DealsAndSearchPage() {
  const {
    location,
    sources,
    minDiscount,
    onlyOpen,
    snappPro,
    sortMode,
    viewMode,
    setViewMode,
    patch,
  } = useSettings();
  const { data: tokens, isPending: tokensPending } = useTokens();

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounced = useDebounced(searchQuery, 260);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const sentinel = useRef<HTMLDivElement>(null);

  // Suggestions for Snapp
  const suggestions = useQuery({
    queryKey: ['suggest', debounced, location?.lat, tokens?.snapp],
    enabled: Boolean(tokens?.snapp && location && debounced.trim().length >= 2 && !submittedQuery),
    queryFn: () => snapp.suggest(tokens!.snapp!, debounced.trim(), location!),
    staleTime: 5 * 60_000,
  });

  // Deals feed – only when no search is active
  const dealsEnabled = Boolean(
    location &&
    !submittedQuery &&
    !tokensPending &&
    (tokens?.snapp || sources.jet || sources.okala),
  );
  const dealsKey = useMemo(
    () => [
      'deals',
      submittedQuery || 'none',
      location?.lat,
      location?.lng,
      sources,
      minDiscount,
      onlyOpen,
      snappPro,
      tokens?.snapp,
    ],
    [
      submittedQuery,
      location?.lat,
      location?.lng,
      sources,
      minDiscount,
      onlyOpen,
      snappPro,
      tokens?.snapp,
    ],
  );

  const dealsQuery = useInfiniteQuery({
    queryKey: dealsKey,
    enabled: dealsEnabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      dealsPage(
        pageParam,
        location!,
        { sources, minDiscount, onlyOpen, snappPro },
        { snapp: tokens?.snapp, jet: tokens?.jet, okala: tokens?.okala },
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  // Search mutation – active when a query is submitted
  const search = useMutation({
    mutationFn: (term: string) =>
      hunt(
        term,
        location!,
        { sources, sortMode, onlyCampaign: false, onlyOpen, minDiscount, snappPro },
        {
          snapp: tokens?.snapp ?? null,
          jet: tokens?.jet ?? null,
          okala: tokens?.okala ?? null,
        },
      ),
    onSuccess: (_, term) => useSettings.getState().rememberQuery(term),
  });

  const runSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setSearchQuery(trimmed);
    setShowSuggestions(false);
    search.mutate(trimmed);
  };

  const clearSearch = () => {
    setSubmittedQuery('');
    setSearchQuery('');
    search.reset();
    queryClient.invalidateQueries({ queryKey: dealsKey });
  };

  // Re-run search when sort changes
  useEffect(() => {
    if (submittedQuery) {
      search.mutate(submittedQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode, sources, onlyOpen, minDiscount, snappPro, submittedQuery]);

  // Refresh deals when visible
  const refreshDeals = useCallback(
    () => queryClient.resetQueries({ queryKey: dealsKey, exact: true }),
    [queryClient, dealsKey],
  );

  const fetchedAt = dealsQuery.data?.pages[0]?.fetchedAt ?? 0;
  useEffect(() => {
    if (!fetchedAt || submittedQuery) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt > FRESH_FOR) {
        void refreshDeals();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchedAt, refreshDeals, submittedQuery]);

  // Infinite scroll for deals
  useEffect(() => {
    const node = sentinel.current;
    if (!node || submittedQuery || !dealsQuery.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !dealsQuery.isFetchingNextPage)
          dealsQuery.fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [dealsQuery, submittedQuery]);

  const dealsOffers = useMemo(
    () => sortByDiscount((dealsQuery.data?.pages ?? []).flatMap((p) => p.offers)),
    [dealsQuery.data],
  );

  const errors = useMemo(
    () => [...new Set((dealsQuery.data?.pages ?? []).flatMap((p) => p.errors))],
    [dealsQuery.data],
  );

  const skipped = useMemo(
    () => (dealsQuery.data?.pages ?? []).reduce((sum, page) => sum + page.firstOrderSkipped, 0),
    [dealsQuery.data],
  );

  const searchNotes = useMemo(() => {
    if (!search.data) return [];
    const list: string[] = [];
    if (search.data.stats.relaxed)
      list.push('نتیجهٔ دقیق پیدا نشد؛ نزدیک‌ترین موارد نمایش داده شده.');
    if (search.data.stats.firstOrderSkipped)
      list.push(
        `${money.format(search.data.stats.firstOrderSkipped)} آیتم «ویژه خرید اول» خوانده نشد.`,
      );
    if (search.data.stats.unverified)
      list.push(`${money.format(search.data.stats.unverified)} پیشنهاد بدون تأیید قفسه حذف شد.`);
    return [...list, ...search.data.errors];
  }, [search.data]);

  if (!location) return <LocationPrompt />;
  if (!tokensPending && !tokens?.snapp && !sources.jet && !sources.okala) return <SignInPrompt />;

  const gridClass = viewMode === 'compact' ? 'offer-grid offer-grid--compact' : 'offer-grid';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 12px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {submittedQuery ? `جستجو: «${submittedQuery}»` : 'بیشترین تخفیف‌ها'}
        </h1>
        {submittedQuery && (
          <button
            type="button"
            className="button"
            style={{ fontSize: '12px' }}
            onClick={clearSearch}
          >
            پاک کردن جستجو
          </button>
        )}
      </div>

      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(searchQuery);
        }}
        autoComplete="off"
      >
        <input
          ref={inputRef}
          type="search"
          value={searchQuery}
          placeholder="جستجوی کالا… مثلاً پفک مینو"
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
        />
        <button className="button button--primary" type="submit" disabled={search.isPending}>
          {search.isPending && submittedQuery ? 'در حال جستجو…' : 'جستجو'}
        </button>

        {showSuggestions && !submittedQuery && (suggestions.data?.length ?? 0) > 0 && (
          <ul className="suggestions">
            {suggestions.data!.slice(0, 8).map((keyword) => (
              <li
                key={keyword}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchQuery(keyword);
                  runSearch(keyword);
                }}
              >
                {keyword}
              </li>
            ))}
          </ul>
        )}
      </form>

      {!submittedQuery && (
        <div className="filters">
          <label>
            حداقل تخفیف
            <select
              value={String(minDiscount)}
              onChange={(e) => patch({ minDiscount: Number(e.target.value) })}
            >
              <option value="0">همه</option>
              <option value="20">۲۰٪+</option>
              <option value="30">۳۰٪+</option>
              <option value="50">۵۰٪+</option>
              <option value="70">۷۰٪+</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={sources.snapp}
              onChange={(e) => patch({ sources: { ...sources, snapp: e.target.checked } })}
            />
            اسنپ‌مارکت
          </label>
          <label>
            <input
              type="checkbox"
              checked={sources.jet}
              onChange={(e) => patch({ sources: { ...sources, jet: e.target.checked } })}
            />
            دیجی‌کالا جت
          </label>
          <label>
            <input
              type="checkbox"
              checked={sources.okala}
              onChange={(e) => patch({ sources: { ...sources, okala: e.target.checked } })}
            />
            اوکالا
          </label>
          <label>
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => patch({ onlyOpen: e.target.checked })}
            />
            فقط فروشگاه باز
          </label>

          <div
            className="segmented"
            role="radiogroup"
            aria-label="حالت نمایش"
            style={{ marginInlineStart: 'auto' }}
          >
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
      )}

      {submittedQuery && (
        <div className="filters">
          <label>
            ترتیب
            <select
              value={sortMode}
              onChange={(e) => patch({ sortMode: e.target.value as SortMode })}
            >
              {Object.entries(SORT_MODES).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => patch({ onlyOpen: e.target.checked })}
            />
            فقط فروشگاه باز
          </label>
          <label>
            <input
              type="checkbox"
              checked={sources.jet}
              onChange={(e) => patch({ sources: { ...sources, jet: e.target.checked } })}
            />
            دیجی‌کالا جت
          </label>
          <label>
            <input
              type="checkbox"
              checked={sources.okala}
              onChange={(e) => patch({ sources: { ...sources, okala: e.target.checked } })}
            />
            اوکالا
          </label>

          <div
            className="segmented"
            role="radiogroup"
            aria-label="حالت نمایش"
            style={{ marginInlineStart: 'auto' }}
          >
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
      )}

      {useSettings.getState().recentQueries.length > 0 && !submittedQuery && !searchQuery && (
        <p className="muted">
          اخیر:{' '}
          {useSettings.getState().recentQueries.map((recent) => (
            <button
              key={recent}
              type="button"
              className="chip"
              style={{ margin: '0 0 6px 6px' }}
              onClick={() => {
                setSearchQuery(recent);
                runSearch(recent);
              }}
            >
              {recent}
            </button>
          ))}
        </p>
      )}

      {!submittedQuery && !tokens?.snapp && sources.snapp && (
        <p className="note">بدون ورود به اسنپ‌مارکت فقط تخفیف‌های دیجی‌کالا جت را می‌بینی.</p>
      )}

      {errors.length > 0 && <p className="note note--error">{errors.join(' — ')}</p>}

      {/* Loading states */}
      {submittedQuery && search.isPending && (
        <>
          <div className="progress" />
          <div className={gridClass}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        </>
      )}
      {!submittedQuery && dealsQuery.isPending && dealsEnabled && (
        <>
          <div className="progress" />
          <div className={gridClass}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        </>
      )}

      {/* Deals feed */}
      {!submittedQuery && dealsOffers.length > 0 && (
        <>
          <div className="feed-status">
            <p className="muted">
              {money.format(dealsOffers.length)} پیشنهاد
              {fetchedAt > 0 && ` · به‌روز شده ساعت ${clock.format(fetchedAt)}`}
              {skipped > 0 && ` · ${money.format(skipped)} آیتم «ویژه خرید اول» نادیده گرفته شد`}
            </p>
            <button
              type="button"
              className="button"
              onClick={() => void refreshDeals()}
              disabled={dealsQuery.isFetching}
            >
              {dealsQuery.isFetching && !dealsQuery.isFetchingNextPage
                ? 'در حال تازه‌سازی…'
                : 'تازه‌سازی'}
            </button>
          </div>
          <div className={gridClass}>
            {dealsOffers.map((offer, i) => (
              <OfferCard
                key={`${offer.platform}-${offer.vendor.code}-${offer.productId}`}
                offer={offer}
                highlight={i === 0}
              />
            ))}
          </div>
          <div ref={sentinel} style={{ height: 1 }} />
          {dealsQuery.isFetchingNextPage && <div className="progress" style={{ marginTop: 12 }} />}
          {!dealsQuery.hasNextPage && dealsOffers.length > 0 && (
            <p className="empty">به انتهای فهرست رسیدی.</p>
          )}
        </>
      )}

      {/* Search results */}
      {submittedQuery && search.data && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {money.format(search.data.stats.vendorCount)} فروشگاه ·{' '}
            {money.format(search.data.offers.length)} پیشنهاد
          </p>
          {searchNotes.length > 0 && <p className="note">{searchNotes.join(' — ')}</p>}
          <div className={gridClass}>
            {search.data.offers.map((offer, i) => (
              <OfferCard
                key={`${offer.platform}-${offer.vendor.code}-${offer.productId}`}
                offer={offer}
                highlight={i === 0}
              />
            ))}
          </div>
          {search.data.offers.length === 0 && (
            <p className="empty">چیزی پیدا نشد. عبارت کوتاه‌تر امتحان کن.</p>
          )}
        </>
      )}

      {!submittedQuery &&
        !dealsQuery.isPending &&
        dealsOffers.length === 0 &&
        errors.length === 0 && (
          <p className="empty">فعلاً تخفیفی در محدودهٔ تو پیدا نشد. حداقل تخفیف را کمتر کن.</p>
        )}
    </>
  );
}
