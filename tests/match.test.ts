import { describe, expect, it } from 'vitest';
import { sameProduct, signature } from '../src/core/match';

// Every pair below is a real title from the platform named, captured from
// live searches around one delivery point.
describe('the same product across platforms', () => {
  it.each([
    ['شیر کم چرب تازه پگاه 946 میلی لیتری', 'شیر کم چرب پگاه - 946 میلی لیتر '],
    ['شیر کم چرب تازه پگاه 946 میلی لیتری', 'شیر کم چرب 1.2% چربی پگاه 946 میلی لیتری'],
    ['شیر کم چرب مدت دار پگاه 1 لیتری', 'شیر کم چرب پگاه - 1 لیتر '],
    ['پفک نمکی مینو 170 گرمی', 'پفک نمکی 170 گ مینو'],
    [
      'روغن سرخ کردنی آفتابگردان و کانولا ورژن 1500 میلی لیتری',
      'روغن سرخ کردنی آفتابگردان و کانولا ورژن 1.5 لیتری',
    ],
    ['ماکارونی قطر 1.2 زر ماکارون 700 گرمی', 'ماکارونی قطر 1.2 زر ماکارون 700 گرمی'],
    ['رب گوجه فرنگی روژین (800 گرم)', 'رب گوجه فرنگی روژین مقدار 800 گرم'],
    ['ماست کم چرب ست میهن 1.5 کیلوگرمی', 'ماست کم‌چرب ست میهن - 1.5 کیلوگرم'],
    ['تخم مرغ مروارید 6 عددی', 'تخم مرغ مروارید بسته 6 عددی'],
    ['آب معدنی واتا 1.5 لیتری', 'آب معدنی واتا - 1500 میلی لیتر'],
    ['ماكارونی پيكولی زر ماکارون 500 گرمی', 'ماکارونی پیکولی زر ماکارون 500 گرمی'],
    ['رب گوجه فرنگی طبیعت 800 گرمی', 'رب گوجه فرنگی آسان بازشو 800 گرمی طبیعت'],
  ])('%s  =  %s', (a, b) => {
    expect(sameProduct(a, b)).toBe('same');
  });
});

describe('never the same product', () => {
  it.each([
    // another size
    ['شیر کم چرب تازه پگاه 946 میلی لیتری', 'شیر کم چرب 1.5% چربی پگاه 1 لیتری'],
    ['ماکارونی قطر 1.2 زر ماکارون 700 گرمی', 'ماکارونی قطر 1.2 زر ماکارون 500 گرمی'],
    // another brand
    ['شیر کم چرب تازه پگاه 946 میلی لیتری', 'شیر کم چرب کاله 946 میلی لیتری'],
    // another shape, another diameter
    ['ماکارونی شلز زر ماکارون 500 گرمی', 'ماکارونی پنه زر ماکارون 500 گرمی'],
    ['ماکارونی قطر 1.2 زر ماکارون 700 گرمی', 'ماکارونی قطر 1.5 زر ماکارون 700 گرمی'],
    // a pack of three is not one carton
    ['شير كم چرب 1.5% چربی میهن 1 لیتری', 'شير كم چرب 1.5% چربی میهن 1 لیتری بسته 3 عددی'],
    // a flavour
    ['شیر کم چرب پگاه 200 میلی لیتر', 'شیر کاکائو کم چرب مدت دار پگاه 200 میلی لیتری'],
    ['نوشابه کولا کوکاکولا 1.5 لیتری', 'نوشابه کولا زیرو کوکاکولا 1.5 لیتری'],
  ])('%s  ≠  %s', (a, b) => {
    expect(sameProduct(a, b)).not.toBe('same');
  });

  it('does not even suggest a swap of brand or shape', () => {
    expect(
      sameProduct('شیر کم چرب تازه پگاه 946 میلی لیتری', 'شیر کم چرب کاله 946 میلی لیتری'),
    ).toBe('different');
    expect(
      sameProduct('ماکارونی شلز زر ماکارون 500 گرمی', 'ماکارونی پنه زر ماکارون 500 گرمی'),
    ).toBe('different');
  });

  it('does not suggest another flavour or variant as a possible match', () => {
    expect(
      sameProduct('شیر کم چرب پگاه - 946 میلی لیتر', 'شیر کاکائو کم چرب تازه پگاه 946 میلی لیتری'),
    ).toBe('different');
    expect(
      sameProduct('نوشابه کولا کوکاکولا 1.5 لیتری', 'نوشابه کولا زیرو کوکاکولا 1.5 لیتری'),
    ).toBe('different');
  });

  it('leaves a title with an extra descriptor for the user to decide', () => {
    expect(
      sameProduct(
        'برنج ایرانی طارم ممتاز معطر گلستان 1 کیلوگرمی',
        'برنج طارم ممتاز گلستان مقدار 1 کیلوگرم',
      ),
    ).toBe('maybe');
  });
});

describe('signature', () => {
  it('reads sizes in any unit and spelling into one scale', () => {
    expect(signature('آب معدنی واتا 1.5 لیتری').sizes).toEqual(['ml:1500']);
    expect(signature('آب معدنی واتا - 1500 میلی لیتر').sizes).toEqual(['ml:1500']);
    expect(signature('برنج هاشمی (5 کیلوگرم)').sizes).toEqual(['g:5000']);
    expect(signature('نوشابه 1.5لیتر').sizes).toEqual(['ml:1500']);
    expect(signature('روغن ۱٫۵ لیتری').sizes).toEqual(['ml:1500']);
    expect(signature('شیر کم لاکتوز یک لیتری پگاه').sizes).toEqual(['ml:1000']);
  });

  it('keeps a number that is not a size as part of the name', () => {
    expect(signature('ماکارونی قطر 1.2 زر ماکارون 700 گرمی').words).toContain('1.2');
  });

  it('does not take the start of a word for a unit', () => {
    expect(signature('رب گوجه 12 گل').sizes).toEqual([]);
  });
});
