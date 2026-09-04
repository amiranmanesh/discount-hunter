import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { hunt, type HuntResult } from '../core/hunt';
import * as snapp from '../api/snapp';
import { SORT_MODES } from '../core/rank';
import type { SortMode } from '../core/types';
import OfferCard from '../components/OfferCard';
import LocationPrompt from '../components/LocationPrompt';
import SignInPrompt from '../components/SignInPrompt';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';

const money = new Intl.NumberFormat('fa-IR');

export default function SearchPage() {
  const settings = useSettings();
  const { location, sortMode, sources, onlyCampaign, onlyOpen, minDiscount, patch } = settings;
  const { data: tokens, isPending: tokensPending } = useTokens();

  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounced = useDebounced(query, 260);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useQuery({
    queryKey: ['suggest', debounced, location?.lat, tokens?.snapp],
    enabled: Boolean(tokens?.snapp && location && debounced.trim().length >= 2),
    queryFn: () => snapp.suggest(tokens!.snapp!, debounced.trim(), location!),
    staleTime: 5 * 60_000,
  });

  const search = useMutation<HuntResult, Error, string>({
    mutationFn: (term) =>
      hunt(
        term,
        location!,
        { sources, sortMode, onlyCampaign, onlyOpen, minDiscount },
        tokens!.snapp!,
        tokens?.jet ?? null,
      ),
    onSuccess: (_, term) => settings.rememberQuery(term),
  });

  const run = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    setSubmitted(trimmed);
    search.mutate(trimmed);
  };

  // Re-run when the ordering changes, so the list is never stale against it.
  useEffect(() => {
    if (submitted) search.mutate(submitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  const result = search.data;
  const notes = useMemo(() => {
    if (!result) return [];
    const list: string[] = [];
    if (result.stats.relaxed) list.push('نتیجهٔ دقیق پیدا نشد؛ نزدیک‌ترین موارد نمایش داده شده.');
    if (result.stats.firstOrderSkipped)
      list.push(
        `${money.format(result.stats.firstOrderSkipped)} آیتم «ویژه خرید اول» خوانده نشد؛ با حساب تو قابل خرید نیست.`,
      );
    if (result.stats.unverified)
      list.push(
        `${money.format(result.stats.unverified)} پیشنهاد نمایش داده نشد چون در قفسهٔ فروشگاه تأیید نشد.`,
      );
    if (result.stats.unlisted)
      list.push(`${money.format(result.stats.unlisted)} پیشنهاد در قفسهٔ فروشگاه پیدا نشد.`);
    list.push(...result.errors);
    return list;
  }, [result]);

  if (!location) return <LocationPrompt />;
  if (!tokensPending && !tokens?.snapp) return <SignInPrompt />;

  return (
    <>
      <h1 className="page-title">جستجوی کالا</h1>

      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          run(query);
        }}
        autoComplete="off"
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="نام کالا یا کد کالا… مثلاً پفک مینو"
          onChange={(event) => {
            setQuery(event.target.value);
            setShowSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
        />
        <button className="button button--primary" type="submit" disabled={search.isPending}>
          {search.isPending ? 'در حال جستجو…' : 'جستجو'}
        </button>

        {showSuggestions && (suggestions.data?.length ?? 0) > 0 && (
          <ul className="suggestions">
            {suggestions.data!.slice(0, 8).map((keyword) => (
              <li
                key={keyword}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(keyword);
                  run(keyword);
                }}
              >
                {keyword}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="filters">
        <label>
          ترتیب
          <select
            value={sortMode}
            onChange={(event) => patch({ sortMode: event.target.value as SortMode })}
          >
            {Object.entries(SORT_MODES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyCampaign}
            onChange={(event) => patch({ onlyCampaign: event.target.checked })}
          />
          فقط تخفیف کمپینی
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(event) => patch({ onlyOpen: event.target.checked })}
          />
          فقط فروشگاه باز
        </label>
        <label>
          <input
            type="checkbox"
            checked={sources.jet}
            onChange={(event) => patch({ sources: { ...sources, jet: event.target.checked } })}
          />
          دیجی‌کالا جت
        </label>
      </div>

      {settings.recentQueries.length > 0 && !submitted && (
        <p className="muted">
          اخیر:{' '}
          {settings.recentQueries.map((recent) => (
            <button
              key={recent}
              type="button"
              className="chip"
              style={{ margin: '0 0 6px 6px' }}
              onClick={() => {
                setQuery(recent);
                run(recent);
              }}
            >
              {recent}
            </button>
          ))}
        </p>
      )}

      {search.isPending && (
        <>
          <div className="progress" />
          <div className="offer-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton" />
            ))}
          </div>
        </>
      )}

      {search.error && <p className="note note--error">{search.error.message}</p>}
      {notes.length > 0 && <p className="note">{notes.join(' — ')}</p>}

      {result && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {money.format(result.stats.vendorCount)} فروشگاه اطراف ·{' '}
            {money.format(result.offers.length)} پیشنهاد · اسنپ‌مارکت{' '}
            {money.format(result.stats.bySource.snapp)} · جت{' '}
            {money.format(result.stats.bySource.jet)}
          </p>
          <div className="offer-grid">
            {result.offers.map((offer, index) => (
              <OfferCard
                key={`${offer.platform}-${offer.vendor.code}-${offer.productId}`}
                offer={offer}
                highlight={index === 0}
              />
            ))}
          </div>
          {result.offers.length === 0 && (
            <p className="empty">
              چیزی پیدا نشد. تیک «فقط تخفیف کمپینی» را بردار یا عبارت کوتاه‌تری امتحان کن.
            </p>
          )}
        </>
      )}
    </>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
