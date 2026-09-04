# مستند اندپوینت‌ها

هر چیزی که در این فایل است با هارنس `recon/capture.mjs` از خود وب‌اپ‌ها ضبط شده
(مرورگر واقعی، نشست واقعی) — نه از مستند رسمی. ممکن است بدون اطلاع تغییر کند.

---

## اسنپ‌مارکت — `https://svc.snapp.market`

### پارامترهای مشترک

هر درخواست این‌ها را روی query string دارد:

```
client=PWA&deviceType=PWA&appVersion=1.399.10&UDID=<uuid>&lat=<lat>&long=<lng>
```

هدرهای لازم: `authorization: Bearer <token>` و `origin: https://snapp.market`
(بدون `origin`/`referer` اندپوینت توکن جواب نمی‌دهد).

### توکن مهمان

```http
POST /oauth2/default/token
Content-Type: application/json

{"data":{
  "time":"<ISO8601>",
  "device_uid":"<uuid>",
  "client_id":"snappfood_pwa",
  "grant_type":"client_credentials",
  "scope":"mobile_v2 mobile_v1 webview",
  "client_secret":"snappfood_pwa_secret"
}}
```

پاسخ: `data.access_token` — JWT با اعتبار حدود ۳ روز.

### توکن کاربر لاگین‌کرده

در خود PWA اینجا نگهداری می‌شود:

```js
JSON.parse(localStorage['persist:siteState']).auth; // → authTokens.data.accessToken
```

اعتبار حدود یک ساعت. آدرس‌های ذخیره‌شده‌ی کاربر هم در همان ساختار:

```js
JSON.parse(localStorage['persist:siteState']).user; // → information.data.user.addresses[]
// هر آدرس: { id, label, address, latitude, longitude, city }
```

### فروشگاه‌های نزدیک که تخفیف نارنجی دارند

```http
GET /market-party/{lat}/{lng}?deal_type=supermarket&isPro=false&page=0&page_size=20
```

```jsonc
{
  "data": {
    "total_count": 44, // کل فروشگاه‌های واجد شرایط
    "title": "تخفیف نارنجی",
    "vendors": [
      {
        "vendor_id": 114250,
        "vendor_code": "09eyeq",
        "vendor_name": "…",
        "delivery_fee": 29900, // با تخفیف ارسال پرو محاسبه شده
        "delivery_time": 45,
        "IsPro": false,
        "IsOpen": true,
        "rating": 9,
        "products": [/* حداکثر ۱۰ کالا */],
        "personalizedProducts": [/* پیشنهاد شخصی */],
      },
    ],
  },
}
```

> `page_size` بزرگ‌تر از ۲۰ هم می‌گیرد. `products` هر فروشگاه در این پاسخ **حداکثر ۱۰ تا** است،
> برای همین افزونه قفسه‌ی کامل هر فروشگاه را جدا می‌گیرد.

### قفسه‌ی کامل تخفیف نارنجی یک فروشگاه

```http
GET /market-party/{vendorCode}?variable={vendorCode}&page_size=100
```

```jsonc
{
  "data": {
    "title": "تخفیف نارنجی",
    "firstActivePeriodEndRFC": "2026-09-04T16:30:03Z", // پایان دوره‌ی کمپین
    "products": {
      "List": [
        {
          "productVariationId": 4087371,
          "productVariationTitle": "بستنی ویفرنا زعفرانی میهن 75 گرمی",
          "price": 70000, // قیمت پیش از تخفیف، تومان
          "discount": 19600, // مبلغ تخفیف، تومان  → قیمت نهایی = price - discount
          "discountRatio": 28,
          "stock": 70,
          "is_out_of_stock": false,
          "vendorId": "114250",
          "vendorCode": "09eyeq",
          "vendorTitle": "…",
          "deliveryFee": "29900",
          "minOrder": 110000,
          "menu_category_title": "بستنی و فالوده",
          "segment": "general", // یا "new_user" برای تخفیف‌های ویژه‌ی کاربر جدید
          "discountId": 5008084210,
        },
      ],
    },
    "personalizedProducts": { "List": [/* همان ساختار */] },
  },
}
```

### همه‌ی فروشگاه‌های نزدیک (فارغ از کمپین)

```http
GET /express-vendor/general/vendors-list
      ?page=0&page_size=50&is_home=false&page_type=vendor_list
      &pro_discount=18000&pro_client=snapp
```

`data.finalResult[].data` شامل `id, code, title, deliveryFee, deliveryTime, is_pro,`
`isOpen, rate, minimumOrderValue, coupons`. بدون `pro_discount` هزینه‌ی ارسالِ
بدون‌تخفیف برمی‌گردد (مثلاً ۳۲۰۰۰ به جای ۲۰۰۰).

### جستجوی کاتالوگ (بین فروشگاه‌ها)

```http
GET /mobile/v3/product-vendors/search
      ?page=0&size=30&query=<q>&new_search=1&superType[]=4&source=2&personalize=true
```

```jsonc
{ "items": [{
    "id": 15096041,
    "document_id": "15096041-110925",   // "<productId>-<vendorId>"
    "title": "پفک نمکی مینو 60 گرمی",
    "price": 65000, "discount": 6500, "discountRatio": 10,
    "images": [{ "main": "…" }]
  }],
  "pagination": { … }, "total": … }
```

`document_id` تنها راه رسیدن به فروشگاه است؛ باید با ایندکس `vendors-list` join شود.

### پیشنهاد کلیدواژه

```http
GET /mobile/v3/search/suggest?query=<q>&source=2
→ { "suggested_keywords": ["پفک اسنک", "پفک نمکی", …] }
```

### لینک فروشگاه

```
https://snapp.market/supermarket/<slug>/<vendorCode>
```

`slug` فقط تزئینی است؛ `vendorCode` مسیریابی را انجام می‌دهد.

---

## دیجی‌کالا جت — `https://api.digikalajet.ir`

دامنه‌ی وب `www.digikalajet.com` است (نه `jet.digikala.com` که اصلاً resolve نمی‌شود).
جستجو **احراز هویت لازم ندارد** — فقط `latitude` و `longitude`.

### جستجو در همه‌ی فروشگاه‌های محدوده

```http
GET /products/search/all/?q=<q>&shopId=&latitude=<lat>&longitude=<lng>&page=1&sort=26&ch=jj
```

`sort=26` همان «بیشترین تخفیف» سایت است (۲۰ ارزان‌ترین، ۲۱ گران‌ترین، ۱ جدیدترین، ۲۲ پیش‌فرض).

```jsonc
{ "status": 200, "data": {
  "pager": { "current_page": 1, "total_pages": 77, "total_items": 1526, "rows_on_page": 20 },
  "result": [{
    "id": 23437528, "product_id": "191116822452",
    "title": "پفک نمکی مینو - 110 گرم",
    "media": "https://dkstatics-public.digikala.com/…",
    "price": {
      "price": 1150000,            // ریال، پیش از تخفیف
      "discount": 0,               // ریال  → نهایی = (price - discount) / 10 تومان
      "discount_percentage": 0
    },
    "badges": { "is_amazing": false, "is_special_sale": false, "is_kalabarg": false },
    "stock": { "has_stock": true, "is_running_low": false },
    "shop": {
      "id": "197118504341", "title": "لیدو مارکت",
      "delivery": { "cost": 0, "estimate_time": 35, "is_free_by_plus": false },
      "working_status": { "is_open": true },
      "rating": { "rate": 4.8, "rate_count": "+10930" }
    }
  }],
  "filters": [ … ], "sort": [ … ]
}}
```

> **همه‌ی مبالغ ریال هستند.** `is_amazing` معادل «تخفیف نارنجی» اسنپ‌مارکت است.

### جستجو داخل یک فروشگاه

```http
GET /products/search/shop/{shopId}/?q=<q>&latitude=<lat>&longitude=<lng>
```

### لینک فروشگاه

مسیر `/shop/<id>/` وجود ندارد و به صفحه‌ی اصلی برمی‌گردد. لینک درست، جستجوی محدود به فروشگاه است:

```
https://www.digikalajet.com/search/?q=<q>&shopId=<shopId>
```

### اندپوینت‌های دیگر که دیده شد

| اندپوینت                                             | کار                              |
| ---------------------------------------------------- | -------------------------------- |
| `GET /first-load/?latitude=&longitude=`              | بوت‌استرپ اپ + نقطه‌ی تحویل فعلی |
| `GET /v3/main-page/?latitude=&longitude=`            | صفحه‌ی اصلی و ویجت‌ها            |
| `GET /post-process/amazing-widget-on-other-lines/1/` | ردیف شگفت‌انگیز صفحه‌ی اصلی      |

---

## چیزهایی که موقع کشف به آن‌ها خوردیم

- `jet.digikala.com` وجود ندارد؛ دامنه `www.digikalajet.com` و API روی `.ir` است.
- اندپوینت توکن اسنپ‌مارکت بدون هدر `origin`/`referer` جواب نمی‌دهد.
- `GET /market-party/{lat}/{lng}` با pagination ساختارش عوض می‌شود:
  بدون `page` کلید `data.products.List` دارد، با `page` کلید `data.vendors[]`.
- کروم منابع افزونه را در پروفایل کش می‌کند؛ برای تست باید پروفایل پاک شود.
