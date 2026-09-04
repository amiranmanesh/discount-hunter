import { SORT_MODES, totalCost } from '../src/core/rank.js';

const el = (id) => document.getElementById(id);
const ui = {
  locationChip: el('locationChip'),
  locationLabel: el('locationLabel'),
  locationPanel: el('locationPanel'),
  addressList: el('addressList'),
  latInput: el('latInput'),
  lngInput: el('lngInput'),
  saveLocation: el('saveLocation'),
  closeLocation: el('closeLocation'),
  searchForm: el('searchForm'),
  queryInput: el('queryInput'),
  searchButton: el('searchButton'),
  suggestions: el('suggestions'),
  sortMode: el('sortMode'),
  onlyOrange: el('onlyOrange'),
  onlyOpen: el('onlyOpen'),
  minDiscount: el('minDiscount'),
  srcSnapp: el('srcSnapp'),
  srcJet: el('srcJet'),
  progress: el('progress'),
  progressBar: el('progressBar'),
  progressText: el('progressText'),
  banner: el('banner'),
  results: el('results'),
  statusBar: el('statusBar'),
  template: el('offerTemplate'),
};

const money = new Intl.NumberFormat('fa-IR');
const toman = (value) => `${money.format(Math.round(value))} تومان`;

let state = null;
let addresses = [];
let busy = false;

send({ type: 'get-state' }).then(init).catch(showError);

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) return reject(new Error(runtimeError.message));
      if (!response?.ok) return reject(new Error(response?.error || 'خطای ناشناخته'));
      resolve(response.result);
    });
  });
}

function init(loaded) {
  state = loaded;
  addresses = loaded.addresses || [];

  for (const [value, label] of Object.entries(SORT_MODES)) {
    ui.sortMode.append(new Option(label, value));
  }
  ui.sortMode.value = state.sortMode;
  ui.onlyOrange.checked = state.onlyOrange;
  ui.onlyOpen.checked = state.onlyOpen;
  ui.minDiscount.value = String(state.minDiscount ?? 0);
  ui.srcSnapp.checked = state.sources?.snapp !== false;
  ui.srcJet.checked = state.sources?.jet !== false;

  renderLocation();
  renderAddresses();

  if (state.lastResult?.offers?.length) {
    ui.queryInput.value = state.lastResult.query || '';
    renderResults(state.lastResult, { cached: true });
  } else {
    renderEmpty('نام کالا را بنویس تا بین فروشگاه‌های اطرافت دنبال بیشترین تخفیف بگردم.');
  }

  if (!state.session?.snappLoggedIn) {
    showBanner(
      state.session?.expired
        ? 'نشست اسنپ‌مارکت منقضی شده. تب <b>snapp.market</b> را باز و رفرش کن، وگرنه قیمت‌ها مهمان است.'
        : 'برای قیمت‌های «پرو» و درست، یک تب <b>snapp.market</b> باز کن و وارد حساب شو. بدون آن هم جستجو کار می‌کند، اما قیمت‌ها مهمان است.',
    );
  }
}

/* ---------- location ---------- */

function renderLocation() {
  const location = state.location;
  ui.locationLabel.textContent = location
    ? location.label || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    : 'موقعیت تنظیم نشده';
  if (location) {
    ui.latInput.value = location.lat;
    ui.lngInput.value = location.lng;
  }
}

function renderAddresses() {
  ui.addressList.replaceChildren();
  if (!addresses.length) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'آدرس ذخیره‌شده‌ای پیدا نشد. مختصات را دستی وارد کن یا وارد اسنپ‌مارکت شو.';
    ui.addressList.append(note);
    return;
  }
  for (const address of addresses) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'address';
    const platform = address.source === 'jet' ? 'دیجی‌کالا جت' : 'اسنپ‌مارکت';
    button.innerHTML =
      `<b>${escapeHtml(address.label)} <em>${platform}</em></b>` +
      `<span>${escapeHtml(address.address)}</span>`;
    button.addEventListener('click', () =>
      applyLocation({ lat: address.lat, lng: address.lng, label: address.label }),
    );
    ui.addressList.append(button);
  }
}

async function applyLocation(location) {
  state = await send({ type: 'set-state', patch: { location } });
  state.addresses = addresses;
  renderLocation();
  ui.locationPanel.hidden = true;
}

ui.locationChip.addEventListener('click', () => {
  ui.locationPanel.hidden = !ui.locationPanel.hidden;
});
ui.closeLocation.addEventListener('click', () => {
  ui.locationPanel.hidden = true;
});
ui.saveLocation.addEventListener('click', () => {
  const lat = Number(ui.latInput.value);
  const lng = Number(ui.lngInput.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return showError(new Error('مختصات نامعتبر است'));
  applyLocation({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
});

/* ---------- filters ---------- */

for (const [input, key] of [
  [ui.sortMode, 'sortMode'],
  [ui.minDiscount, 'minDiscount'],
]) {
  input.addEventListener('change', async () => {
    const value = key === 'minDiscount' ? Number(input.value) : input.value;
    state = { ...(await send({ type: 'set-state', patch: { [key]: value } })), addresses };
    if (state.lastResult?.offers?.length) runHunt();
  });
}
for (const [input, key] of [
  [ui.onlyOrange, 'onlyOrange'],
  [ui.onlyOpen, 'onlyOpen'],
]) {
  input.addEventListener('change', async () => {
    state = { ...(await send({ type: 'set-state', patch: { [key]: input.checked } })), addresses };
  });
}
for (const input of [ui.srcSnapp, ui.srcJet]) {
  input.addEventListener('change', async () => {
    const sources = { snapp: ui.srcSnapp.checked, jet: ui.srcJet.checked };
    state = { ...(await send({ type: 'set-state', patch: { sources } })), addresses };
  });
}

/* ---------- suggestions ---------- */

let suggestTimer = null;
ui.queryInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const query = ui.queryInput.value.trim();
  if (busy || query.length < 2 || !state?.location) return hideSuggestions();
  suggestTimer = setTimeout(async () => {
    try {
      const list = await send({ type: 'suggest', query, location: state.location });
      if (busy) return hideSuggestions();
      renderSuggestions(list);
    } catch {
      hideSuggestions();
    }
  }, 260);
});
ui.queryInput.addEventListener('blur', () => setTimeout(hideSuggestions, 160));

function renderSuggestions(list) {
  if (!list?.length) return hideSuggestions();
  ui.suggestions.replaceChildren();
  for (const keyword of list.slice(0, 8)) {
    const item = document.createElement('li');
    item.textContent = keyword;
    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      ui.queryInput.value = keyword;
      hideSuggestions();
      runHunt();
    });
    ui.suggestions.append(item);
  }
  ui.suggestions.hidden = false;
}

function hideSuggestions() {
  ui.suggestions.hidden = true;
}

/* ---------- hunting ---------- */

ui.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  hideSuggestions();
  runHunt();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'hunt-progress' || !busy) return;
  const { progress } = message;
  const total = progress.total || 0;
  const loaded = progress.loaded || 0;
  const ratio = total ? Math.min(loaded / total, 1) : 0.15;
  ui.progressBar.style.setProperty('--value', `${Math.round(ratio * 100)}%`);
  const label = progress.source === 'jet' ? 'دیجی‌کالا جت' : 'اسنپ‌مارکت';
  ui.progressText.textContent =
    progress.phase === 'shelves'
      ? `${label}: بررسی قفسه ${loaded} از ${total}`
      : `${label}: ${loaded}${total ? ` از ${total}` : ''}`;
});

async function runHunt() {
  const query = ui.queryInput.value.trim();
  if (!query) return;
  if (!state?.location) {
    ui.locationPanel.hidden = false;
    return showError(new Error('اول موقعیت تحویل را انتخاب کن'));
  }
  if (busy) return;

  busy = true;
  clearTimeout(suggestTimer);
  hideSuggestions();
  ui.searchButton.disabled = true;
  ui.progress.hidden = false;
  ui.progressBar.style.setProperty('--value', '8%');
  ui.progressText.textContent = 'در حال جستجو…';
  ui.banner.hidden = true;
  ui.results.replaceChildren();
  ui.statusBar.textContent = '';

  try {
    const result = await send({
      type: 'hunt',
      query,
      location: state.location,
      options: {
        sortMode: ui.sortMode.value,
        onlyOrange: ui.onlyOrange.checked,
        onlyOpen: ui.onlyOpen.checked,
        minDiscount: Number(ui.minDiscount.value),
        sources: { snapp: ui.srcSnapp.checked, jet: ui.srcJet.checked },
      },
    });
    renderResults(result, { cached: false });
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    ui.searchButton.disabled = false;
    ui.progress.hidden = true;
  }
}

/* ---------- rendering ---------- */

function renderResults(result, { cached }) {
  ui.results.replaceChildren();
  const offers = result.offers || [];

  if (!offers.length) {
    renderEmpty('چیزی پیدا نشد. فیلتر «فقط تخفیف کمپینی» را بردار یا عبارت کوتاه‌تری امتحان کن.');
  } else {
    const fragment = document.createDocumentFragment();
    offers.slice(0, 40).forEach((offer, index) => fragment.append(renderOffer(offer, index === 0)));
    ui.results.append(fragment);
  }

  const stats = result.stats || {};
  const parts = [];
  if (stats.vendorCount) parts.push(`${money.format(stats.vendorCount)} فروشگاه اطراف`);
  parts.push(`${money.format(offers.length)} پیشنهاد`);
  if (stats.authenticated) parts.push('حساب اسنپ‌مارکت متصل');
  if (cached) parts.push('نتیجه‌ی ذخیره‌شده');
  ui.statusBar.textContent = parts.join(' · ');

  const notes = [];
  if (stats.relaxed) notes.push('نتیجه‌ی دقیق پیدا نشد؛ نزدیک‌ترین موارد نمایش داده شده.');
  if (stats.targetedSkipped) {
    notes.push(
      `${money.format(stats.targetedSkipped)} پیشنهاد «کاربر جدید» نادیده گرفته شد؛ قابل خرید نیست.`,
    );
  }
  if (stats.unlisted) {
    notes.push(
      `${money.format(stats.unlisted)} پیشنهاد حذف شد چون در قفسه‌ی خود فروشگاه پیدا نشد.`,
    );
  }
  if (!stats.authenticated) {
    notes.push('بدون حساب متصل — قیمت‌ها مهمان است و ممکن است با فروشگاه فرق کند.');
  }
  if (result.errors?.length) notes.push(...result.errors);
  if (notes.length) showBanner(notes.map(escapeHtml).join(' — '));
}

function renderOffer(offer, isTop) {
  const node = ui.template.content.firstElementChild.cloneNode(true);
  if (isTop) node.classList.add('top');

  const image = node.querySelector('.offer-image');
  image.src = offer.image || '';
  image.alt = offer.title;

  const platform = node.querySelector('.badge.platform');
  platform.textContent = offer.platformLabel;
  platform.classList.add(offer.platform);

  const campaign = node.querySelector('.badge.campaign');
  campaign.textContent = offer.campaignLabel;
  if (offer.targeted) {
    campaign.classList.add('targeted');
    campaign.title = 'تخفیف سگمنتی؛ ممکن است در سبد شما اعمال نشود';
  }

  const discount = node.querySelector('.badge.discount');
  if (offer.discountPercent > 0)
    discount.textContent = `${money.format(offer.discountPercent)}٪ تخفیف`;
  else discount.remove();

  node.querySelector('.offer-title').textContent = offer.title;
  node.querySelector('.final').textContent = toman(offer.finalPrice);
  const original = node.querySelector('.original');
  if (offer.discountAmount > 0) original.textContent = money.format(offer.price);
  else original.remove();

  node.querySelector('.vendor-name').textContent = offer.vendor.name;

  const meta = [];
  if (offer.vendor.isPro) meta.push('⚡ پرو');
  meta.push(
    offer.vendor.deliveryFee > 0 ? `ارسال ${toman(offer.vendor.deliveryFee)}` : 'ارسال رایگان',
  );
  if (offer.vendor.deliveryTime) meta.push(`${money.format(offer.vendor.deliveryTime)} دقیقه`);
  if (offer.vendor.rating) meta.push(`★ ${offer.vendor.rating}`);
  if (offer.vendor.isOpen === false) meta.push('بسته');
  node.querySelector('.vendor-meta').textContent = meta.join(' · ');

  const totals = [`جمع با ارسال: ${toman(totalCost(offer))}`];
  if (offer.verified) totals.push('✓ قیمت از خود فروشگاه');
  if (offer.vendor.minOrder) totals.push(`حداقل سبد ${toman(offer.vendor.minOrder)}`);
  node.querySelector('.total-cost').textContent = totals.join(' · ');

  node.querySelector('.open-store').addEventListener('click', () => {
    send({ type: 'open-url', url: offer.url }).catch(showError);
  });

  return node;
}

function renderEmpty(text) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  ui.results.replaceChildren(div);
}

function showBanner(html) {
  ui.banner.innerHTML = html;
  ui.banner.hidden = false;
}

function showError(error) {
  showBanner(escapeHtml(error?.message || String(error)));
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
