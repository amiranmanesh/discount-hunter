import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { dealsPage, sortByDiscount } from '../core/deals';
import OfferCard from '../components/OfferCard';
import LocationPrompt from '../components/LocationPrompt';
import SignInPrompt from '../components/SignInPrompt';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';

const money = new Intl.NumberFormat('fa-IR');

/**
 * The discount feed: every campaign offer near you, deepest discount first,
 * across both platforms. No query, no filters to set — just scroll.
 */
export default function DealsPage() {
  const { location, sources, minDiscount, onlyOpen, patch } = useSettings();
  const { data: tokens, isPending: tokensPending } = useTokens();
  const sentinel = useRef<HTMLDivElement>(null);

  const enabled = Boolean(location) && !tokensPending && Boolean(tokens?.snapp || sources.jet);

  const query = useInfiniteQuery({
    queryKey: [
      'deals',
      location?.lat,
      location?.lng,
      sources,
      minDiscount,
      onlyOpen,
      tokens?.snapp,
    ],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      dealsPage(
        pageParam,
        location!,
        { sources, minDiscount, onlyOpen },
        tokens?.snapp ?? null,
        tokens?.jet ?? null,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const offers = useMemo(
    () => sortByDiscount((query.data?.pages ?? []).flatMap((page) => page.offers)),
    [query.data],
  );

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
  if (!tokensPending && !tokens?.snapp && !sources.jet) return <SignInPrompt />;

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
          <p className="muted" style={{ marginTop: 0 }}>
            {money.format(offers.length)} پیشنهاد
            {skipped > 0 && ` · ${money.format(skipped)} آیتم «ویژه خرید اول» نادیده گرفته شد`}
          </p>
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
