import { beforeEach, describe, expect, it } from 'vitest';
import { favKey, useFavorites } from '../src/store/favorites';
import type { Offer } from '../src/core/types';

const testOffer: Offer = {
  platform: 'snapp',
  platformLabel: 'اسنپ‌مارکت',
  productId: 'p100',
  catalogId: 'cat100',
  title: 'پفک مینو 100 گرمی',
  image: 'https://example.com/item.jpg',
  category: 'تنقلات',
  price: 20000,
  finalPrice: 15000,
  discountAmount: 5000,
  discountPercent: 25,
  isCampaign: true,
  campaignLabel: 'تخفیف ویژه',
  segment: 'general',
  targeted: false,
  stock: 10,
  outOfStock: false,
  vendor: {
    id: 'v1',
    code: 'vend1',
    name: 'هایپرمارکت',
    logo: '',
    deliveryFee: 10000,
    deliveryTime: 30,
    isPro: false,
    isOpen: true,
    rating: 4.5,
    minOrder: 50000,
  },
  url: 'https://snapp.ir/product/cat100',
};

describe('favorites store', () => {
  beforeEach(() => {
    useFavorites.setState({ favorites: [] });
  });

  it('generates consistent favKey', () => {
    expect(favKey('snapp', 'p100', 'cat100')).toBe('snapp:cat100');
    expect(favKey('jet', 'p200')).toBe('jet:p200');
  });

  it('toggles favorite on and off', () => {
    expect(useFavorites.getState().isFavorite(testOffer)).toBe(false);

    useFavorites.getState().toggleFavorite(testOffer);
    expect(useFavorites.getState().isFavorite(testOffer)).toBe(true);
    expect(useFavorites.getState().favorites).toHaveLength(1);

    useFavorites.getState().toggleFavorite(testOffer);
    expect(useFavorites.getState().isFavorite(testOffer)).toBe(false);
    expect(useFavorites.getState().favorites).toHaveLength(0);
  });

  it('removes favorite by id', () => {
    useFavorites.getState().toggleFavorite(testOffer);
    const key = favKey(testOffer.platform, testOffer.productId, testOffer.catalogId);

    useFavorites.getState().removeFavorite(key);
    expect(useFavorites.getState().favorites).toHaveLength(0);
  });

  it('clears all favorites', () => {
    useFavorites.getState().toggleFavorite(testOffer);
    useFavorites.getState().clearFavorites();
    expect(useFavorites.getState().favorites).toHaveLength(0);
  });
});
