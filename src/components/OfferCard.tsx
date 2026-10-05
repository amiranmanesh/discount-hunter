'use client';

import { memo } from 'react';
import type { Offer } from '../core/types';
import { totalCost } from '../core/rank';
import { refFromOffer, refKey } from '../core/basket';
import { useBasket } from '../store/basket';
import { useFavorites } from '../store/favorites';
import { useSettings, type ViewMode } from '../store/settings';

const money = new Intl.NumberFormat('en-US');
const toman = (value: number) => `${money.format(Math.round(value))} تومان`;

interface Props {
  offer: Offer;
  highlight?: boolean;
  viewMode?: ViewMode;
}

function FavoriteButton({ offer }: { offer: Offer }) {
  const isFav = useFavorites((state) => state.isFavorite(offer));
  const toggleFav = useFavorites((state) => state.toggleFavorite);

  return (
    <button
      type="button"
      className={`offer-fav${isFav ? ' offer-fav--active' : ''}`}
      onClick={() => toggleFav(offer)}
      aria-label={isFav ? 'حذف از نشان‌شده‌ها' : 'افزودن به نشان‌شده‌ها'}
      title={isFav ? 'حذف از نشان‌شده‌ها' : 'افزودن به نشان‌شده‌ها'}
    >
      <svg
        viewBox="0 0 24 24"
        fill={isFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
}

function OfferCard({ offer, highlight = false, viewMode }: Props) {
  const storeViewMode = useSettings((state) => state.viewMode);
  const activeMode = viewMode ?? storeViewMode;

  const meta: string[] = [];
  if (offer.vendor.isPro) meta.push('⚡ پرو');
  meta.push(
    offer.vendor.deliveryFeeUnknown
      ? 'ارسال نامعلوم'
      : offer.vendor.deliveryFee > 0
        ? `ارسال ${toman(offer.vendor.deliveryFee)}`
        : 'ارسال رایگان',
  );
  if (offer.vendor.serviceFee) meta.push(`خدمات ${toman(offer.vendor.serviceFee)}`);
  if (offer.vendor.deliveryTime) meta.push(`${money.format(offer.vendor.deliveryTime)}د`);
  if (offer.vendor.rating) meta.push(`★ ${offer.vendor.rating}`);
  if (offer.vendor.isOpen === false) meta.push('بسته');

  if (activeMode === 'compact') {
    return (
      <article className={`offer offer--compact${highlight ? ' offer--top' : ''}`}>
        {offer.image ? (
          <img className="offer-image" src={offer.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="offer-image" aria-hidden="true" />
        )}

        <div className="offer-body">
          <div className="offer-compact-header">
            <h3 className="offer-title">{offer.title}</h3>
            <div className="badges">
              <span className={`badge badge--${offer.platform}`}>{offer.platformLabel}</span>
              {offer.discountPercent > 0 && (
                <span className="badge badge--discount">
                  {money.format(offer.discountPercent)}٪
                </span>
              )}
            </div>
          </div>

          <div className="offer-compact-meta">
            <div className="offer-price">
              <strong>{toman(offer.finalPrice)}</strong>
              {offer.discountAmount > 0 && <s>{money.format(offer.price)}</s>}
            </div>
            <div className="offer-vendor-line">
              <b>{offer.vendor.name}</b>
              <span className="muted"> · {meta.join(' · ')}</span>
            </div>
          </div>
        </div>

        <div className="offer-actions offer-actions--compact">
          <FavoriteButton offer={offer} />
          <BasketButton offer={offer} compact />
          <a
            className="offer-open"
            href={offer.url}
            target="_blank"
            rel="noreferrer noopener"
            title="باز کردن در فروشگاه"
          >
            ↗
          </a>
        </div>
      </article>
    );
  }

  const totals: string[] = [
    offer.vendor.deliveryFeeUnknown
      ? 'جمع با ارسال: نامعلوم'
      : `جمع با ارسال: ${toman(totalCost(offer))}`,
  ];
  if (offer.verified) totals.push('✓ قیمت از خود فروشگاه');
  if (offer.vendor.minOrder) totals.push(`حداقل سبد ${toman(offer.vendor.minOrder)}`);

  return (
    <article className={`offer${highlight ? ' offer--top' : ''}`}>
      {offer.image ? (
        <img className="offer-image" src={offer.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="offer-image" aria-hidden="true" />
      )}

      <div className="offer-body">
        <div className="badges">
          <span className={`badge badge--${offer.platform}`}>{offer.platformLabel}</span>
          <span className="badge badge--campaign">{offer.campaignLabel}</span>
          {offer.discountPercent > 0 && (
            <span className="badge badge--discount">
              {money.format(offer.discountPercent)}٪ تخفیف
            </span>
          )}
          {offer.vendor.isPro && <span className="badge badge--pro">پرو</span>}
        </div>

        <h3 className="offer-title">{offer.title}</h3>

        <div className="offer-price">
          <strong>{toman(offer.finalPrice)}</strong>
          {offer.discountAmount > 0 && <s>{money.format(offer.price)}</s>}
        </div>

        {offer.pagePrice !== undefined && (
          <p className="offer-note">
            صفحهٔ محصول {toman(offer.pagePrice)} نشان می‌دهد؛ بقیهٔ تخفیف موقع پرداخت با «استفاده از
            تخفیف شگفت‌انگیز» کم می‌شود.
          </p>
        )}

        <div className="offer-vendor">
          <b>{offer.vendor.name}</b>
          <span>{meta.join(' · ')}</span>
        </div>

        <div className="offer-foot">
          <span className="offer-total">{totals.join(' · ')}</span>
          <span className="offer-actions">
            <FavoriteButton offer={offer} />
            <BasketButton offer={offer} />
            <a className="offer-open" href={offer.url} target="_blank" rel="noreferrer noopener">
              باز کردن ↗
            </a>
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Adds the product — not this store's listing of it — to the basket, which
 * later prices it everywhere. Only the product's own id is checked here, so a
 * long list of cards stays cheap to re-render.
 */
function BasketButton({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const key = refKey(refFromOffer(offer));
  const quantity = useBasket(
    (state) => state.items.find((item) => item.refs.some((ref) => refKey(ref) === key))?.quantity,
  );
  const add = useBasket((state) => state.add);

  return (
    <button
      type="button"
      className={`offer-open offer-basket${quantity ? ' offer-basket--in' : ''}`}
      onClick={() => add(offer)}
      aria-label={quantity ? `یکی دیگر به سبد (الان ${quantity})` : 'افزودن به سبد'}
    >
      {quantity
        ? compact
          ? `✓ ${money.format(quantity)}`
          : `✓ سبد ${money.format(quantity)}`
        : compact
          ? '+ سبد'
          : '+ سبد'}
    </button>
  );
}

export default memo(OfferCard);
