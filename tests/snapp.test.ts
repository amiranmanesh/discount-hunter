import { describe, expect, it } from 'vitest';
import * as snapp from '../src/api/snapp';

const vendor = {
  id: 114250,
  code: '09eyeq',
  name: 'اسمارت تهران نو (سوپرمارکت زنجیره ای اسنپ)',
  logo: '',
  deliveryFee: 31900,
  deliveryTime: 45,
  isPro: false,
  isOpen: true,
  rating: 9,
  minOrder: 0,
};

describe('links', () => {
  it('opens the product inside the store that sells it, not the store alone', () => {
    const offer = snapp.toOffer(
      {
        productVariationId: 9799128,
        productVariationTitle: 'روغن سرخ کردنی ورژن 900 میلی لیتری',
        price: 958000,
        discount: 239500,
        discountRatio: 25,
        segment: 'general',
      },
      vendor,
    );

    const url = new URL(offer.url);
    expect(url.origin).toBe('https://snapp.market');
    expect(url.pathname).toMatch(/^\/supermarket\/[^/]+\/09eyeq\/product-details\/9799128$/);
  });

  it('keeps a slash in the store name from adding a path segment', () => {
    const url = snapp.productUrl({ name: 'فروشگاه  راکت / نارمک', code: 'abc' }, 1);
    const [, , slug, ...rest] = new URL(url).pathname.split('/');
    expect(decodeURIComponent(slug)).toBe('فروشگاه-راکت-/-نارمک');
    expect(rest).toEqual(['abc', 'product-details', '1']);
  });
});
