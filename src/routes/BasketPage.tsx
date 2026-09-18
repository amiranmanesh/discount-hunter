'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LocationPrompt from '../components/LocationPrompt';
import {
  askMinimums,
  gather,
  refKey,
  usable,
  withMinimums,
  type BasketItem,
  type Line,
} from '../core/basket';
import { better, plan, type Plan } from '../core/plan';
import { useBasket } from '../store/basket';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';
import type { PlatformId } from '../core/types';

const money = new Intl.NumberFormat('fa-IR');
const toman = (value: number) => `${money.format(Math.round(value))} تومان`;
const clock = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });

const PLATFORM_LABEL: Record<PlatformId, string> = {
  snapp: 'اسنپ‌مارکت',
  jet: 'دیجی‌کالا جت',
  okala: 'اوکالا',
};

/** Prices older than this are asked for again when the page comes back into view. */
const FRESH_FOR = 5 * 60_000;

export default function BasketPage() {
  const { location, sources, snappPro } = useSettings();
  const { data: tokens, isPending: tokensPending } = useTokens();
  const { items, maxOrders, setQuantity, remove, clear, accept, reject, setMaxOrders } =
    useBasket();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Okala minimums learned so far, by store. Kept across re-plans: a store's
  // minimum does not change because the basket did.
  const [minimums, setMinimums] = useState<Map<string, number | null>>(() => new Map());

  // Prices depend on which products are in the basket, not on how many of
  // each or on which equivalents were accepted — those only re-plan.
  const shape = items.map((item) => `${item.id}:${refKey(item.refs[0])}`).join(',');
  const queryKey = [
    'basket',
    location?.lat,
    location?.lng,
    sources,
    snappPro,
    tokens?.snapp,
    tokens?.okala,
    shape,
  ];

  const prices = useQuery({
    queryKey,
    enabled: Boolean(location) && !tokensPending && items.length > 0,
    staleTime: FRESH_FOR,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const result = await gather(items, location!, {
        sources,
        snappPro,
        tokens: { snapp: tokens?.snapp, jet: tokens?.jet, okala: tokens?.okala },
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setProgress(null);
      return { ...result, fetchedAt: Date.now() };
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey, exact: true });

  useEffect(() => {
    const fetchedAt = prices.data?.fetchedAt;
    if (!fetchedAt) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt > FRESH_FOR) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices.data?.fetchedAt, queryClient, shape]);

  const plans = useMemo(() => {
    if (!prices.data) return null;
    const lines = prices.data.lines.filter((line) => {
      const item = items.find((entry) => entry.id === line.itemId);
      return item ? usable(item, line) : false;
    });
    return plan(
      items.map((item) => ({ id: item.id, quantity: item.quantity })),
      withMinimums(prices.data.stores, minimums),
      lines,
      3,
    );
  }, [prices.data, items, minimums]);

  // Okala stores a plan picked whose minimum basket is not known yet. Asking
  // for them and planning again until none are left gives the same answer as
  // knowing every store's minimum up front, at a fraction of the requests.
  const pending = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of plans?.byOrders ?? []) {
      for (const order of entry?.orders ?? []) {
        if (order.store.minOrderPending) keys.add(order.store.key);
      }
    }
    return [...keys].sort().join(',');
  }, [plans]);

  useEffect(() => {
    if (!pending || !location) return;
    let cancelled = false;
    void askMinimums(pending.split(','), location).then((found) => {
      if (!cancelled) setMinimums((held) => new Map([...held, ...found]));
    });
    return () => {
      cancelled = true;
    };
  }, [pending, location]);

  if (!location) return <LocationPrompt />;

  if (!items.length) {
    return (
      <>
        <h1 className="page-title">سبد خرید</h1>
        <div className="card stack">
          <b>سبد خالی است</b>
          <p className="muted" style={{ margin: 0 }}>
            کالاهایی را که می‌خواهی با دکمهٔ «+ سبد» از جستجو یا فهرست تخفیف‌ها اضافه کن. بعد
            همین‌جا می‌گوییم هرکدام را از کدام فروشگاه و پلتفرم بخری که کمترین پول را بدهی — با
            هزینهٔ ارسال و حداقل سبد هر فروشگاه.
          </p>
          <div className="row">
            <Link className="button button--primary" href="/search">
              جستجوی کالا
            </Link>
            <Link className="button" href="/">
              فهرست تخفیف‌ها
            </Link>
          </div>
        </div>
      </>
    );
  }

  // «At most n orders» for n = 1, 2, 3: the cheapest plan that needs no more.
  const choices = ([1, 2, 3] as const).map((limit) => ({
    limit,
    entry: (plans?.byOrders.slice(1, limit + 1) ?? []).reduce<Plan<Line> | null>(
      (held, entry) => (entry && (!held || better(entry, held)) ? entry : held),
      null,
    ),
  }));
  const shown = choices[maxOrders - 1].entry ?? choices[2].entry;
  const overall = choices[2].entry;
  const ready = Boolean(prices.data && !prices.isFetching && !pending);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <>
      <h1 className="page-title">سبد خرید</h1>

      {(prices.isFetching || (prices.data && pending)) && (
        <div className="card stack" role="status">
          <b>
            {prices.isFetching
              ? 'در حال گرفتن قیمت‌ها از هر فروشگاه…'
              : 'در حال بررسی حداقل سبد فروشگاه‌ها…'}
          </b>
          <div className="progress" />
          {prices.isFetching && progress && progress.total > 0 && (
            <span className="muted">
              {money.format(progress.done)} از {money.format(progress.total)}
            </span>
          )}
        </div>
      )}

      {prices.isError && (
        <p className="note note--error">
          قیمت‌ها گرفته نشد: {prices.error instanceof Error ? prices.error.message : ''}
        </p>
      )}

      {ready &&
        [...prices.data!.skipped.map((entry) => entry.reason), ...prices.data!.errors].map(
          (text) => (
            <p key={text} className="note">
              {text}
            </p>
          ),
        )}

      {ready && shown && (
        <Result
          plan={shown}
          overall={overall}
          choices={choices}
          maxOrders={maxOrders}
          itemById={itemById}
          onChoose={setMaxOrders}
          onReject={(line) => reject(line.itemId, line.ref)}
        />
      )}

      <section className="card basket-items" style={{ marginTop: 10 }}>
        <div className="basket-items-head">
          <b>کالاهای سبد ({money.format(items.length)})</b>
          <button type="button" className="button--link" onClick={clear}>
            خالی کردن سبد
          </button>
        </div>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            lines={prices.data?.lines.filter((line) => line.itemId === item.id) ?? null}
            onQuantity={(value) => setQuantity(item.id, value)}
            onRemove={() => remove(item.id)}
            onAccept={(line) => accept(item.id, line.ref)}
          />
        ))}
      </section>

      {ready && (
        <p className="muted basket-fresh">
          قیمت‌ها ساعت {clock.format(prices.data!.fetchedAt)} گرفته شد —{' '}
          <button type="button" className="button--link" onClick={refresh}>
            تازه‌سازی
          </button>
        </p>
      )}
    </>
  );
}

function ItemRow({
  item,
  lines,
  onQuantity,
  onRemove,
  onAccept,
}: {
  item: BasketItem;
  lines: Line[] | null;
  onQuantity: (value: number) => void;
  onRemove: () => void;
  onAccept: (line: Line) => void;
}) {
  const [open, setOpen] = useState(false);
  const inUse = lines?.filter((line) => usable(item, line)) ?? [];
  const storesCount = new Set(inUse.map((line) => line.storeKey)).size;
  const platforms = new Set(inUse.map((line) => line.platform)).size;

  // Titles the matcher was not sure about, one per product, for the user to settle.
  const doubtful = new Map<string, Line>();
  for (const line of lines ?? []) {
    if (usable(item, line) || item.rejected.includes(refKey(line.ref))) continue;
    const key = refKey(line.ref);
    const held = doubtful.get(key);
    if (!held || line.unitPrice < held.unitPrice) doubtful.set(key, line);
  }

  return (
    <div className="basket-item">
      {item.image ? (
        <img className="basket-thumb" src={item.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="basket-thumb" aria-hidden="true" />
      )}
      <div className="basket-item-body">
        <span className="basket-item-title">{item.title}</span>
        {lines && (
          <span className="muted">
            {inUse.length
              ? `در ${money.format(storesCount)} فروشگاه از ${money.format(platforms)} پلتفرم`
              : 'فعلاً هیچ فروشگاهی در محدوده‌ات ندارد'}
            {doubtful.size > 0 && (
              <>
                {'، '}
                <button type="button" className="button--link" onClick={() => setOpen(!open)}>
                  {money.format(doubtful.size)} کالای شبیه
                </button>
              </>
            )}
          </span>
        )}
        {open && doubtful.size > 0 && (
          <div className="doubtful">
            <span className="muted">
              عنوانشان کمی فرق دارد؛ اگر همین کالاست تأیید کن تا قیمتش هم حساب شود.
            </span>
            {[...doubtful.values()].map((line) => (
              <div key={refKey(line.ref)} className="doubtful-row">
                <span className={`badge badge--${line.platform}`}>
                  {PLATFORM_LABEL[line.platform]}
                </span>
                <span className="doubtful-title">{line.title}</span>
                <button type="button" className="button" onClick={() => onAccept(line)}>
                  همین است
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="stepper" aria-label="تعداد">
        <button
          type="button"
          onClick={() => (item.quantity > 1 ? onQuantity(item.quantity - 1) : onRemove())}
          aria-label={item.quantity > 1 ? 'یکی کمتر' : 'حذف از سبد'}
        >
          {item.quantity > 1 ? '−' : '×'}
        </button>
        <span>{money.format(item.quantity)}</span>
        <button type="button" onClick={() => onQuantity(item.quantity + 1)} aria-label="یکی بیشتر">
          +
        </button>
      </div>
    </div>
  );
}

/** How an option compares with the cheapest overall, in the fewest words that are true. */
function optionNote(entry: Plan<Line> | null, overall: Plan<Line> | null): string {
  if (!entry) return 'ممکن نیست';
  if (!overall || entry === overall) return 'ارزان‌ترین';
  const fewer = entry.missing.length - overall.missing.length;
  if (fewer > 0) return `${money.format(fewer)} کالا کم`;
  if (entry.orders.some((order) => order.shortOfMinimum > 0)) return 'زیر حداقل سبد';
  return `+${money.format(Math.round(entry.total - overall.total))} تومان`;
}

function Result({
  plan: shown,
  overall,
  choices,
  maxOrders,
  itemById,
  onChoose,
  onReject,
}: {
  plan: Plan<Line>;
  overall: Plan<Line> | null;
  choices: { limit: 1 | 2 | 3; entry: Plan<Line> | null }[];
  maxOrders: 1 | 2 | 3;
  itemById: Map<string, BasketItem>;
  onChoose: (limit: 1 | 2 | 3) => void;
  onReject: (line: Line) => void;
}) {
  const saved = shown.listTotal - shown.itemsTotal;
  const short = shown.orders.filter((order) => order.shortOfMinimum > 0);
  const unknownFee = shown.orders.some((order) => order.store.feeUnknown);

  if (!shown.orders.length) {
    return <p className="empty">هیچ‌کدام از این کالاها در فروشگاه‌های محدوده‌ات پیدا نشد.</p>;
  }

  return (
    <div className="stack">
      <section className="card basket-summary">
        <span className="muted">
          {shown === overall
            ? 'ارزان‌ترین راه'
            : `بهترین با حداکثر ${money.format(maxOrders)} سفارش`}
          : {money.format(shown.orders.length)} سفارش
        </span>
        <strong className="basket-total">{toman(shown.total)}</strong>
        <span className="muted">
          کالاها {toman(shown.itemsTotal)} + ارسال و خدمات {toman(shown.feesTotal)}
          {unknownFee && ' (هزینهٔ ارسال یک فروشگاه نامعلوم است)'}
        </span>
        {saved > 0 && (
          <span className="basket-saved">
            تخفیف: {toman(saved)} ({money.format(Math.round((saved / shown.listTotal) * 100))}٪)
          </span>
        )}

        <div className="segmented segmented--wide" role="radiogroup" aria-label="حداکثر سفارش">
          {choices.map(({ limit, entry }) => (
            <button
              key={limit}
              type="button"
              role="radio"
              aria-checked={limit === maxOrders}
              disabled={!entry}
              onClick={() => onChoose(limit)}
            >
              {limit === 1 ? 'یک سفارش' : `تا ${money.format(limit)} سفارش`}
              <small>{optionNote(entry, overall)}</small>
            </button>
          ))}
        </div>
      </section>

      {short.length > 0 && (
        <p className="note">
          {short
            .map(
              (order) =>
                `«${order.store.name}» حداقل سبد ${toman(order.store.minOrder)} دارد؛ ${toman(order.shortOfMinimum)} دیگر لازم است.`,
            )
            .join(' ')}
        </p>
      )}

      {shown.orders.map((order) => (
        <section key={order.store.key} className="card basket-order">
          <div className="basket-order-head">
            <span className={`badge badge--${order.store.platform}`}>
              {PLATFORM_LABEL[order.store.platform]}
            </span>
            <b>{order.store.name}</b>
          </div>
          <span className="muted">
            {order.store.feeUnknown
              ? 'هزینهٔ ارسال نامعلوم'
              : order.store.deliveryFee > 0
                ? `ارسال ${toman(order.store.deliveryFee)}`
                : 'ارسال رایگان'}
            {order.store.serviceFee > 0 && `، خدمات و بسته‌بندی ${toman(order.store.serviceFee)}`}
            {order.store.minOrder > 0 && `، حداقل سبد ${toman(order.store.minOrder)}`}
            {order.store.minOrderUnknown && '، حداقل سبد نامعلوم'}
          </span>

          <ul className="basket-lines">
            {order.lines.map((line) => {
              const item = itemById.get(line.itemId);
              const own = item && refKey(item.refs[0]) === refKey(line.candidate.ref);
              return (
                <li key={line.itemId}>
                  <div className="basket-line-main">
                    <span className="basket-line-title">
                      {line.candidate.title}
                      {!own && <span className="tag">معادل</span>}
                    </span>
                    <span className="basket-line-price">
                      {money.format(line.quantity)} × {toman(line.candidate.unitPrice)}
                      {line.candidate.discountPercent > 0 &&
                        ` (${money.format(line.candidate.discountPercent)}٪ تخفیف)`}
                    </span>
                    {line.candidate.pagePrice !== undefined && (
                      <span className="basket-line-note">
                        صفحهٔ محصول {toman(line.candidate.pagePrice)} نشان می‌دهد؛ بقیه موقع پرداخت
                        با «تخفیف شگفت‌انگیز» کم می‌شود.
                      </span>
                    )}
                  </div>
                  <div className="basket-line-side">
                    <b>{toman(line.total)}</b>
                    <span className="basket-line-links">
                      {!own && (
                        <button
                          type="button"
                          className="button--link"
                          onClick={() => onReject(line.candidate)}
                        >
                          این نیست
                        </button>
                      )}
                      <a href={line.candidate.url} target="_blank" rel="noreferrer noopener">
                        باز کردن ↗
                      </a>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="basket-order-foot">
            <span>جمع این سفارش</span>
            <b>{toman(order.subtotal + order.fees)}</b>
          </div>
        </section>
      ))}

      {shown.missing.length > 0 && (
        <section className="card stack">
          <b>پیدا نشد</b>
          <span className="muted">این‌ها در فروشگاه‌های این ترکیب نیست، یا به این تعداد نیست:</span>
          <ul className="basket-missing">
            {shown.missing.map((id) => (
              <li key={id}>{itemById.get(id)?.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
