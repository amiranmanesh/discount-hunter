import { Link } from 'react-router';

export default function SignInPrompt() {
  return (
    <div className="card stack">
      <b>برای جستجو باید وارد یکی از حساب‌ها باشی</b>
      <p className="muted" style={{ margin: 0 }}>
        قیمت‌ها و شرایط خرید به حساب تو بستگی دارد. اسنپ‌مارکت و اوکالا برای جستجو نشست خودت را
        می‌خواهند — مهمان کمپین دیگری با قیمت دیگری می‌بیند. دیجی‌کالا جت بدون ورود هم جواب می‌دهد؛
        اگر تیکش را زده باشی جستجو کار می‌کند.
      </p>
      <Link className="button button--primary" to="/accounts">
        ورود با شماره موبایل
      </Link>
    </div>
  );
}
