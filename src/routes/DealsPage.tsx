'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { dealsPage, sortByDiscount } from '../core/deals';
import OfferCard from '../components/OfferCard';
import LocationPrompt from '../components/LocationPrompt';
import SignInPrompt from '../components/SignInPrompt';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';

const money = new Intl.NumberFormat('fa-IR');
const clock = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });

/**
 * How old the feed may get before coming back to it starts it over. Campaign
 * prices move by the hour and stock runs out faster; an installed app that sat
 * in the background overnight was showing yesterday's discounts, because
 * nothing ever asked again.
 */
const FRESH_FOR = 5 * 60_000;

/**
 * The discount feed: every campaign offer near you, deepest discount first,
 * across both platforms. No query, no filters to set — just scroll.
 */
export default function DealsPage() {
  const { location, sources, minDiscount, onlyOpen, snappPro, patch } = useSettings();
  const { data: tokens, isPending: tokensPending } = useTokens();
  const sentinel = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const enabled =
    Boolean(location) && !tokensPending && Boolean(tokens?.snapp || sources.jet || sources.okala);

  const queryKey = useMemo(
    () => [
      'deals',
      location?.lat,
      location?.lng,
      sources,
      minDiscount,
      onlyOpen,
      snappPro,
      tokens?.snapp,
    ],
    [location?.lat, location?.lng, sources, minDiscount, onlyOpen, snappPro, tokens?.snapp],
  );

  const query = useInfiniteQuery({
    queryKey,
    enabled,
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

  const offers = useMemo(
    () => sortByDiscount((query.data?.pages ?? []).flatMap((page) => page.offers)),
    [query.data],
  );

  // The first page's time is the feed's age: later pages only extend it.
  const fetchedAt = query.data?.pages[0]?.fetchedAt ?? 0;

  // Starting over rather than refetching in place: a refetch would re-ask for
  // every page scrolled so far, one after another, before showing anything.
  const refresh = useCallback(
    () => queryClient.resetQueries({ queryKey, exact: true }),
    [queryClient, queryKey],
  );

  // Coming back to the app — a tab switch, or an installed app brought back to
  // the front — starts a feed older than FRESH_FOR over.
  useEffect(() => {
    if (!fetchedAt) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt > FRESH_FOR) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchedAt, refresh]);

  // Endless scroll: fetch the next page when the sentinel comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !query.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !query.isFetchingNextPage) query.fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [query]);

  if (!location) return <LocationPrompt />;
  if (!tokensPending && !tokens?.snapp && !sources.jet && !sources.okala) return <SignInPrompt />;

  const errors = [...new Set((query.data?.pages ?? []).flatMap((page) => page.errors))];
  const skipped = (query.data?.pages ?? []).reduce((sum, page) => sum + page.firstOrderSkipped, 0);

  return (
    <>
      <h1 className="page-title">بیشترین تخفیف‌ها</h1>

      <div className="filters">
        <label>
          حداقل تخفیف
          <select
            value={String(minDiscount)}
            onChange={(event) => patch({ minDiscount: Number(event.target.value) })}
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
            onChange={(event) => patch({ sources: { ...sources, snapp: event.target.checked } })}
          />
          اسنپ‌مارکت
        </label>
        <label>
          <input
            type="checkbox"
            checked={sources.jet}
            onChange={(event) => patch({ sources: { ...sources, jet: event.target.checked } })}
          />
          دیجی‌کالا جت
        </label>
        <label>
          <input
            type="checkbox"
            checked={sources.okala}
            onChange={(event) => patch({ sources: { ...sources, okala: event.target.checked } })}
          />
          اوکالا
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(event) => patch({ onlyOpen: event.target.checked })}
          />
          فقط فروشگاه باز
        </label>
      </div>

      {!tokens?.snapp && sources.snapp && (
        <p className="note">بدون ورود به اسنپ‌مارکت فقط تخفیف‌های دیجی‌کالا جت را می‌بینی.</p>
      )}

      {errors.length > 0 && <p className="note note--error">{errors.join(' — ')}</p>}

      {query.isPending && enabled && (
        <>
          <div className="progress" />
          <div className="offer-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton" />
            ))}
          </div>
        </>
      )}

      {offers.length > 0 && (
        <>
          <div className="feed-status">
            <p className="muted">
              {money.format(offers.length)} پیشنهاد
              {fetchedAt > 0 && ` · به‌روز شده ساعت ${clock.format(fetchedAt)}`}
              {skipped > 0 && ` · ${money.format(skipped)} آیتم «ویژه خرید اول» نادیده گرفته شد`}
            </p>
            <button
              type="button"
              className="button"
              onClick={() => void refresh()}
              disabled={query.isFetching}
            >
              {query.isFetching && !query.isFetchingNextPage ? 'در حال تازه‌سازی…' : 'تازه‌سازی'}
            </button>
          </div>
          <div className="offer-grid">
            {offers.map((offer, index) => (
              <OfferCard
                key={`${offer.platform}-${offer.vendor.code}-${offer.productId}`}
                offer={offer}
                highlight={index === 0}
              />
            ))}
          </div>
        </>
      )}

      {!query.isPending && offers.length === 0 && (
        <p className="empty">فعلاً تخفیفی در محدودهٔ تو پیدا نشد. حداقل تخفیف را کمتر کن.</p>
      )}

      <div ref={sentinel} style={{ height: 1 }} />
      {query.isFetchingNextPage && <div className="progress" style={{ marginTop: 12 }} />}
      {!query.hasNextPage && offers.length > 0 && <p className="empty">به انتهای فهرست رسیدی.</p>}
    </>
  );
}
