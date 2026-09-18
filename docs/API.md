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

> **`segment` تعیین می‌کند این قیمت به چه کسی می‌رسد.** روی یک کمپین واقعی اندازه گرفته شد:
> `products.List` صددرصد `general` است و سقف تخفیفش حدود ۴۴٪؛ ولی `personalizedProducts`
> ترکیبی از `general` و `new_user` است و **هر تخفیف ۹۰ تا ۹۹ درصدی، `new_user` است**.
> این قیمت‌ها برای یک حساب قدیمی اصلاً وجود ندارند. مثال واقعی: کمپین برای
> «نوشابه کولا زیرو کوکاکولا ۱.۵ لیتری» در فروشگاه `3kj44n` قیمت ۳۹٬۰۷۲ می‌داد،
> در حالی که قفسهٔ خود فروشگاه همان کالا را با ۸٪ تخفیف، ۱۱۲٬۳۳۲ لیست می‌کرد.
> افزونه هر چیزی که `general` نیست را `targeted` علامت می‌زند و پیش‌فرض حذفش می‌کند.

### جستجو داخل یک فروشگاه (مرجع راستی‌آزمایی)

همان اندپوینتی که صفحهٔ فروشگاه خودش صدا می‌زند. **این منبع حقیقتِ قیمت است**، نه فید کمپین.

```http
GET /mobile/v2/product-variation/search
      ?query=<q>&vendorCode=<code>&firstPage=true&page=0&page_size=10
      &size=10&origin=vp-search&source=2&latitude=<lat>&longitude=<lng>
```

```jsonc
{
  "data": {
    "total": 2,
    "result": [
      {
        "id": 4085636, // با productVariationId کمپین یکی نیست
        "document_id": "4085636-116592",
        "title": "نوشابه کولا زیرو کوکاکولا 1.5 لیتری",
        "price": 122100,
        "discount": 9768,
        "discountRatio": 8,
        "stock": 8,
        "vendor_id": 116592,
        "menu_category_title": "نوشابه",
      },
    ],
  },
}
```

> شناسهٔ کالا بین این اندپوینت و فید کمپین یکی نیست، برای همین تطبیق روی **عنوان**
> انجام می‌شود و شناسه فقط میان‌بر است.

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

### لینک محصول

```
https://snapp.market/supermarket/<slug>/<vendorCode>/product-details/<productVariationId>
```

صفحهٔ همان کالا **داخل همان فروشگاه** — همان مسیری که صفحهٔ فروشگاه خود سایت کالا را با آن باز
می‌کند (`/express-search/mobile/v2/product-variation/view?productVariationId=&vendorCode=`).
`slug` فقط تزئینی است.

- `https://snapp.market/supermarket/<slug>/<vendorCode>` فقط فروشگاه را باز می‌کند و کالا باید
  دوباره جستجو شود.
- `https://snapp.market/product/<slug>/<id>` صفحهٔ بین‌فروشگاهی است
  (`/express-search/v1/pb/products/<id>`) و قیمت را از فروشگاهی که خودش انتخاب می‌کند نشان
  می‌دهد؛ `productVariationId` بین فروشگاه‌ها مشترک است (`document_id` = `<id>-<vendorId>`).

> قیمت «تخفیف نارنجی» فقط در فهرست کمپین (`/market-party/…`) دیده می‌شود. صفحهٔ کالا تخفیف
> عادی فروشگاه را نشان می‌دهد — مثلاً روغن ورژن ۹۰۰ در `09eyeq`: کمپین ۲۵٪، صفحهٔ کالا ۲۰٪.
> هر دو عدد از خود اسنپ‌مارکت است؛ فید با صفحهٔ کمپین خود فروشگاه ۱۲۰ از ۱۲۰ یکی بود.

### هزینهٔ ارسال و اسنپ پرو

فروشگاه‌های «پرو» فقط برای **مشترک اسنپ پرو** ارسال ارزان دارند. سایت `pro_discount` و
`pro_client` را فقط برای حساب پرو می‌فرستد؛ برای بقیه همان هزینهٔ کامل:

| درخواست                                                 | فروشگاه پرو `poj6g8` |
| ------------------------------------------------------- | -------------------- |
| `market-party/{lat}/{lng}` (هر پارامتری)                | ۲٬۰۰۰ — همیشه پرو    |
| `vendors-list` با `pro_discount=18000&pro_client=snapp` | ۲٬۰۰۰                |
| `vendors-list` بدون آن‌ها                               | ۳۴٬۰۰۰               |
| `vendor-switch/suggestions` با `pro_client=false`       | ۳۴٬۰۰۰               |

پس `delivery_fee` فید کمپین برای حساب غیرپرو معتبر نیست و هزینه از `vendors-list` (بدون
پارامتر پرو) خوانده می‌شود. `/mobile/v5/user/pro-info` برای حساب تست خطای `3004` داد، برای همین
پرو بودن یک تنظیم است، نه چیزی که حدس زده شود.

### پیشنهاد فروشگاه برای یک سبد

همان درخواستی که «تعویض فروشگاه» خود سایت می‌زند:

```http
GET /express-vendor/vendor-switch/suggestions
      ?products=[{"product_id":5979228,"quantity":2},…]
      &pro_client=false&pro_discount=0&active_cpc=false
```

```jsonc
[
  {
    "code": "09e876",
    "title": "…",
    "deliveryFee": 0,
    "minimumOrderValue": 170000,
    "totalPrice": 230220,
    "isOpen": true,
    "products": [
      {
        "id": 5979228,
        "price": 127900,
        "discount": 12790,
        "stock": 13,
        "quantity": 2, // به سقف هر سفارش کم می‌شود — مثلاً ۳ خواسته، ۲ داده
        "capacity": null,
        "is_market_party": false,
      },
    ],
  },
]
```

- **حداکثر ۵ فروشگاه** برمی‌گرداند، اول آن‌که بیشتر سبد را دارد و بعد ارزان‌تر.
- `pro_client` باید `true`/`false` باشد (`snapp` خطای اعتبارسنجی می‌دهد).
- قیمت‌ها همان قیمت صفحهٔ کالا در آن فروشگاه است؛ قیمت «تخفیف نارنجی» را اعمال نمی‌کند.

`productVariationId` بین فروشگاه‌ها مشترک است، پس یک شناسه در همهٔ فروشگاه‌ها همان کالاست.

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

### نشست کاربر

توکن در `localStorage['persist:DKNow'].user.token` است (به‌همراه `refreshToken` و `userId`)
و **بدون پیشوند `Bearer`** در هدر `authorization` فرستاده می‌شود:

```http
authorization: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

payload توکن `user_id` و `expire_time` دارد (حدود ۲۴ ساعت اعتبار).

> **جستجو با و بدون توکن دقیقاً یک نتیجه می‌دهد** — همان ردیف‌ها، همان قیمت‌ها،
> همان هزینهٔ ارسال. آزمایش شد. پس لاگین برای قیمت لازم نیست؛ فقط اندپوینت‌های
> خود حساب را باز می‌کند.

### آدرس‌های ذخیره‌شده (نیازمند توکن)

```http
GET /address/
```

```jsonc
{
  "data": {
    "addresses": [
      {
        "id": 21618981,
        "name": null,
        "short_address": "محلاتی، بل ابوذر…",
        "address": "محلاتی، بل ابوذر، بعد از بل پاسدار گمنام",
        "latitude": "35.66786",
        "longitude": "51.48599",
        "in_service_range": true,
      },
    ],
  },
}
```

### جستجو داخل یک فروشگاه

```http
GET /products/search/shop/{shopId}/?q=<q>&latitude=<lat>&longitude=<lng>
```

### یک کالا در همهٔ فروشگاه‌ها

`product_id` بین فروشگاه‌ها مشترک است (همان شیر ۹۴۶ پگاه در سه فروشگاه: سه `id`، یک
`product_id`). `serial_barcode` هم دارد، ولی هیچ‌کدام از سه پلتفرم با بارکد جستجو نمی‌کند، پس
تطبیق بین پلتفرم‌ها با عنوان و حجم است (`src/core/match.ts`).

### لینک محصول

```
https://www.digikalajet.com/shop/product/<shopId>/<id>/
```

`id` شناسهٔ ردیف فهرست است (`55003523`)، نه `product_id` کنار آن (`105113831527`) که اینجا ۴۰۴
می‌دهد. داده‌اش از `GET /shop/<shopId>/product/<id>/` می‌آید.

### فید شگفت‌انگیز («کهکشانی‌ها»)

```http
GET /post-process/amazing-widget-on-other-lines/1/?sourcePage=home&latitude=&longitude=
GET /v2/products/galaxy/?pageName=home&latitude=&longitude=&page=<n>
```

- ردیف‌های galaxy در `data.result` است (قبلاً `data.products`)، پنج‌تا در هر صفحه.
- `shop` در galaxy فقط `{ id }` است، و در هیچ‌کدام از این دو `delivery.cost` نیست. هزینهٔ ارسال،
  نام فروشگاه و حداقل سبد (`cart_close_limit`) از هدر خود فروشگاه می‌آید:

```http
GET /shop/<shopId>/header/?latitude=&longitude=
→ data.shop.delivery.cost   // ریال — همان عددی که صفحهٔ فروشگاه نشان می‌دهد
```

- **تخفیف دو بخش دارد.** صفحهٔ محصول فقط `vendor_discount + brand_discount` را نشان می‌دهد؛ بقیهٔ
  `discount` سهم شگفت‌انگیز است و موقع پرداخت با «استفاده از تخفیف شگفت‌انگیز» کم می‌شود (به‌جای
  کد تخفیف، نه همراهش). روی همهٔ ردیف‌های galaxy اندازه گرفته شد.

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
- فید کمپین قیمت قابل خرید نیست: `segment` را باید دید و قیمت را با
  `/mobile/v2/product-variation/search` راستی‌آزمایی کرد.
- توکن کاربر بسته به بیلد سایت، هم در `persist:siteState` و هم در کلید سادهٔ
  `JWT` دیده شده — و بخشی از عمر نشست، اسلایس redux خالی است.

---

## اوکالا — `https://apigateway.okala.com`

از طریق پروکسی: `/api/okala/*`. همهٔ قیمت‌ها **ریال** است.

### هدرهای مشترک

گیت‌وی روی هر درخواست این دو را می‌خواهد، و درخواست بدون توکن را صریح علامت می‌زند:

```
x-user-unique-id: <uuid ثابت هر دستگاه>
x-correlation-id: <uuid هر درخواست>
x-skip-authorization: true        # فقط روی کال‌های بدون توکن
```

### ورود

```http
POST /api/voyager/C/CustomerAccount/OTPRegister
Content-Type: application/json

{"mobile":"09xxxxxxxxx","deviceTypeCode":10,"confirmTerms":true,
 "notRobot":false,"otpType":0,"ValidationCodeCreateReason":5,
 "OtpApp":0,"IsAppOnly":false}
→ {"success":true,"message":null,"data":null}
```

```http
POST /api/v1/accounts/tokens
Content-Type: application/x-www-form-urlencoded

mobile_number=09xxxxxxxxx&otp_code=<code>&grant_type=customer_grant_type
&client_id=customer_client_id&client_secret=<از خود وب‌اپ>
&client_name=customer_client_name&device_type_code=10&scope=offline_access
```

```jsonc
{
  "access_token": "…", // JWT نیست
  "expires_in": 36000, // ۱۰ ساعت
  "token_type": "Bearer",
  "refresh_token": "…", // رشتهٔ مبهم
  "UserInfo": { "Id": 899433, "MobilePhone": "09…" },
}
```

> توکن JWT نیست، پس انقضا از `expires_in` گرفته می‌شود نه از خود توکن.
> وب‌اپ اوکالا هیچ‌وقت refresh نمی‌زند و بعد از ۱۰ ساعت دوباره لاگین می‌کند؛
> برنامه هم همین کار را می‌کند به‌جای اینکه یک grant حدسی بزند.

### فروشگاه‌های نزدیک — بدون توکن

```http
GET /api/opex/v4/stores/nearby?latitude=<lat>&longitude=<lng>
```

```jsonc
{
  "data": {
    "stores": [
      {
        "storeId": 53846,
        "storeName": "وزرا",
        "logo": "…",
        "rate": 4.2,
        "distance": 0.36,
        "deliveryPrice": 0, // ریال
        "onDemandEta": "01:00:00", // ساعت:دقیقه:ثانیه
        "operationPrice": 105000, // ریال — «هزینه خدمات»، روی هر سفارش
        "packagingPrice": 30000, // ریال — بسته‌بندی، روی هر سفارش
      },
    ],
  },
}
```

### فید تخفیف — بدون توکن

همان چیزی که صفحهٔ اصلی سایت می‌گیرد: حدود ۱۶ کاروسل × تا ۱۲ کالا در **یک** درخواست.
صفحه‌بندی ندارد، پس فقط صفحهٔ اول فید را پر می‌کند.

```http
GET /api/carousel/v4/offers?pageType=HomePage&lat=<lat>&lon=<lng>
      &storeIds=53846&storeIds=8294&…        # تکرارشونده، از stores/nearby
```

```jsonc
{
  "carousels": [
    {
      "title": "تخفیف آخرهفته",
      "products": [
        {
          "id": 681680,
          "name": "بستنی چوبی وانیلی ویژه دومینو 60 گرمی بسته 3 عددی",
          "price": 1500000, // ریال، قبل از تخفیف
          "okPrice": 1275000, // ریال، چیزی که می‌پردازی
          "discountPercent": 15,
          "isShowDiscount": true,
          "quantity": 22,
          "hasQuantity": true,
          "storeId": 2045,
          "storeName": "پلاتینیوم",
          "webLink": "/product/681680",
        },
      ],
    },
  ],
}
```

### جستجو — **نیازمند توکن**

```http
GET /api/unicorn/v2/cumulative/search/nearby?q=<q>&lat=<lat>&lon=<lng>&v4Stores=true
Authorization: Bearer <access_token>
```

نتیجه بر اساس فروشگاه گروه‌بندی شده — `data` یک شیء با کلیدهای `0..n` است، نه آرایه:

```jsonc
{
  "data": {
    "0": {
      "store": {
        "storeId": 54844,
        "storeName": "علیشاهی",
        "deliveryPrice": 0,
        "rate": 4.2,
        "distance": 2.04,
        "onDemandEta": "01:00:00",
      },
      "products": [
        {
          "id": 190926,
          "name": "پفک نمکی مینو 60 گرمی",
          "price": 650000,
          "okPrice": 609375,
          "discountPercent": 6,
          "isShowDiscount": true,
          "quantity": 13,
          "hasQuantity": true,
        },
      ],
    },
  },
  "success": true,
}
```

> ارسال اوکالا معمولاً رایگان است، ولی سبد خرید سایت `operationPrice` و `packingPrice` را روی هر
> سفارش اضافه می‌کند (حدود ۱۳ هزار تومان). این دو فقط در `stores/nearby` هست؛ ردیف کاروسل و
> فروشگاهِ نتیجهٔ جستجو ندارندشان و باید با `storeId` join شوند.

### حداقل سبد فروشگاه

فقط در جزئیات خود فروشگاه است — نه در `stores/nearby`، نه در جستجو، نه در سبد خالی:

```http
GET /api/opex/v2/stores/details?Latitude=<lat>&longitude=<lng>&StoreId=<id>&customerSegments=
→ { "data": { "storeName": "دیان", "minimumOrder": 3500000, … } }   // ریال
```

دور یک نقطه از ۱۵۰ تا ۳۵۰ هزار تومان فرق می‌کرد. سبد فقط برای فروشگاه‌هایی که پلن انتخابشان
می‌کند می‌پرسد.

### شناسهٔ کالا بین فروشگاه‌ها

`id` کالا ممکن است بین فروشگاه‌ها فرق کند؛ `masterProductId` ثابت است
(«شیر کم چرب غنی شده دامداران»: سه `id`، یک `masterProductId`).

### جستجوی ناموفق بی‌دلیل

گیت‌وی گاهی `{"data":null,"success":false,"errorMessage":null}` می‌دهد — حدود یک جستجو از ده،
با هر میزان هم‌زمانی — و همان درخواست لحظه‌ای بعد موفق است. برنامه دو بار دیگر امتحان می‌کند.

### لینک محصول

```
https://www.okala.com/store/<storeId>/product/<id>/<name>
```

همان `singlePdpUrl` خود سایت. `https://www.okala.com/product/<id>` فروشگاه ندارد و بدون
فروشگاهِ انتخاب‌شده «تمام شد» نشان می‌دهد.

### نکته‌هایی که موقع کشف به آن‌ها خوردیم

- قیمت‌ها ریال است: `finalPrice = okPrice / 10`، `price` قیمت پیش از تخفیف.
- `stores/nearby` و `carousel/v4/offers` توکن نمی‌خواهند؛ فقط `search` می‌خواهد.
- `data` در جستجو شیء است نه آرایه؛ `Object.values` لازم است.
- `access_token` امضای JWT ندارد، پس انقضا فقط از `expires_in` می‌آید.
