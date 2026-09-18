// Is this listing the same product as that one?
//
// Inside one platform the answer is an id: Snapp Market's product variation,
// Digikala Jet's `product_id` and Okala's `masterProductId` each name one
// product across every store that sells it. Across platforms there is no shared
// id — only Jet sends a barcode, and none of the three searches by one — so the
// title is all there is, and the three spell the same carton differently:
//
//   Snapp Market  شیر کم چرب تازه پگاه 946 میلی لیتری
//   Digikala Jet  شیر کم چرب پگاه - 946 میلی لیتر
//   Okala         شیر کم چرب 1.2% چربی پگاه 946 میلی لیتری
//
// A wrong match is worse than a missed one: it prices the basket with a product
// the user did not ask for. So the rule is strict. The sizes must be equal, and
// once packaging words and fat percentages are set aside, neither title may
// carry a word the other lacks — «شیر کاکائو کم چرب پگاه» is not «شیر کم چرب
// پگاه» however much of it overlaps.

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

type Kind = 'g' | 'ml' | 'n';

/** Longest spellings first, so «کیلوگرمی» is not read as «کیلو» + «گرمی». */
const UNITS: [RegExp, Kind, number][] = [
  [/^(کیلوگرمی|کیلوگرم|کیلو|kg)/, 'g', 1000],
  [/^(گرمی|گرم|gr|g|گ)/, 'g', 1],
  [/^(میلی ?لیتری|میلی ?لیتر|میلیلیتر|میل|ml|سی ?سی|cc)/, 'ml', 1],
  [/^(لیتری|لیتر|l)/, 'ml', 1000],
  [/^(عددی|عدد|تایی|تا|رول|قطعه|برگی|برگ|حلقه)/, 'n', 1],
];

/**
 * Words that describe the packet rather than the product. Snapp Market adds
 * «تازه» and «مدت دار», Okala adds «x% چربی», and a carton is a carton.
 */
const SOFT = new Set([
  'تازه',
  'مدت',
  'دار',
  'مدتدار',
  'پاکتی',
  'پاکت',
  'بطری',
  'قوطی',
  'پت',
  'شیشه',
  'ای',
  'نایلونی',
  'تترا',
  'پک',
  'تتراپک',
  'esl',
  'بسته',
  'بندی',
  'سایز',
  'حجم',
  'وزن',
  'جدید',
  'طرح',
  'مدل',
  'مقدار',
  'مایع',
  'پاستوریزه',
  'اسان', // «آسان», after folding
  'بازشو',
  'چربی',
  'و',
  'با',
  'در',
  'از',
  'به',
  'برای',
  'حاوی',
]);

/**
 * Words that make a different product of the same name: a flavour, a sugar or
 * fat variant. «شیر کاکائو کم چرب پگاه» is one word away from «شیر کم چرب
 * پگاه» and nothing like it, so a title that differs by one of these is not
 * even offered as a possible match. Spelled as `fold` leaves them.
 */
const VARIANTS = new Set([
  'کاکائو',
  'کاکائویی',
  'کاکایو',
  'شکلات',
  'شکلاتی',
  'موز',
  'توت',
  'فرنگی',
  'وانیل',
  'وانیلی',
  'قهوه',
  'عسل',
  'زعفران',
  'زعفرانی',
  'نارگیل',
  'پرتقال',
  'سیب',
  'هلو',
  'انبه',
  'البالو',
  'لیمو',
  'لیمویی',
  'نعناع',
  'دارچین',
  'پسته',
  'فندق',
  'بادام',
  'هویج',
  'زیرو',
  'رژیمی',
  'لایت',
  'بدون',
  'لاکتوز',
  'کودک',
  'پرچرب',
  'نیم',
  'کامل',
  'تند',
  'سرکه',
  'پنیری',
  'کچاپ',
  'پیاز',
  'جعفری',
]);

export interface Signature {
  /** Content words, packaging and percentages removed. */
  words: string[];
  /** `g:900`, `ml:946`, `n:6` — sorted, so two signatures compare as strings. */
  sizes: string[];
}

function fold(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ۀ/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[‌‎‏]/g, ' ') // ZWNJ and bidi marks
    .toLowerCase();
}

export function signature(title: string): Signature {
  let text = fold(title || '');
  // «1/5 لیتری» and «1٫5» are how a decimal is often typed in Persian.
  text = text.replace(/(\d)\s*[/٫,](\s*\d)/g, '$1.$2').replace(/\.\s+(\d)/g, '.$1');
  text = text.replace(/(^|\s)یک(?=\s*(لیتر|کیلو))/g, '$11');

  // Percentages describe the milk, not which carton it is.
  text = text.replace(/\d+(\.\d+)?\s*[%٪]/g, ' ');

  const sizes: string[] = [];
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*([\p{L} ]{0,12})/gu,
    (whole, number: string, rest: string) => {
      const tail = rest.trimStart();
      for (const [pattern, kind, factor] of UNITS) {
        const unit = tail.match(pattern);
        // The unit has to end where a word ends: «گ» must not eat «گوجه».
        if (unit && !/^\p{L}/u.test(tail.slice(unit[0].length))) {
          const value = Math.round(Number(number) * factor * 10) / 10;
          // «1 عدد» is how a single item is described, not a pack size.
          if (!(kind === 'n' && value === 1)) sizes.push(`${kind}:${value}`);
          return ` ${tail.slice(unit[0].length)}`;
        }
      }
      return whole;
    },
  );

  const words = text
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .replace(/(^|\s)\.+|\.+(?=\s|$)/g, ' ')
    .split(' ')
    .filter((word) => word && !SOFT.has(word));

  return { words: [...new Set(words)], sizes: sizes.sort() };
}

export type Verdict = 'same' | 'maybe' | 'different';

/**
 * `same` is safe to price with. `maybe` shares the size and most of the words
 * but not all — «شیر کم چرب غنی شده» against «شیر کم چرب» — and is left for the
 * user to accept rather than assumed.
 */
export function compare(a: Signature, b: Signature): Verdict {
  if (a.sizes.join('|') !== b.sizes.join('|')) return 'different';
  const inB = new Set(b.words);
  const common = a.words.filter((word) => inB.has(word)).length;
  if (common === 0) return 'different';
  const onlyA = a.words.length - common;
  const onlyB = b.words.length - common;
  if (onlyA === 0 && onlyB === 0 && (common >= 2 || a.words.length === 1)) return 'same';
  // Each side having a word the other lacks is a substitution — another brand,
  // another shape, another flavour — and never the same product. One title
  // being the other plus a word or two is worth asking about.
  if (onlyA > 0 && onlyB > 0) return 'different';
  const extra =
    onlyA > 0
      ? a.words.filter((word) => !inB.has(word))
      : b.words.filter((word) => !a.words.includes(word));
  if (extra.some((word) => VARIANTS.has(word))) return 'different';
  return common >= 2 && extra.length <= 2 ? 'maybe' : 'different';
}

export function sameProduct(a: string, b: string): Verdict {
  return compare(signature(a), signature(b));
}
