import { memo } from 'react';
import type { Offer } from '../core/types';
import { totalCost } from '../core/rank';

const money = new Intl.NumberFormat('fa-IR');
const toman = (value: number) => `${money.format(Math.round(value))} تومان`;

interface Props {
  offer: Offer;
  highlight?: boolean;
}

function OfferCard({ offer, highlight = false }: Props) {
  const meta: string[] = [];
  if (offer.vendor.isPro) meta.push('⚡ پرو');
  meta.push(
    offer.vendor.deliveryFee > 0 ? `ارسال ${toman(offer.vendor.deliveryFee)}` : 'ارسال رایگان',
  );
  if (offer.vendor.deliveryTime) meta.push(`${money.format(offer.vendor.deliveryTime)} دقیقه`);
  if (offer.vendor.rating) meta.push(`★ ${offer.vendor.rating}`);
  if (offer.vendor.isOpen === false) meta.push('بسته');

  const totals: string[] = [`جمع با ارسال: ${toman(totalCost(offer))}`];
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

        <div className="offer-vendor">
          <b>{offer.vendor.name}</b>
          <span>{meta.join(' · ')}</span>
        </div>

        <div className="offer-foot">
          <span className="offer-total">{totals.join(' · ')}</span>
          <a className="offer-open" href={offer.url} target="_blank" rel="noreferrer noopener">
            باز کردن ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export default memo(OfferCard);
