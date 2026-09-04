import { Link } from 'react-router';

export default function SignInPrompt() {
  return (
    <div className="card stack">
      <b>برای جستجو باید وارد حساب اسنپ‌مارکت باشی</b>
      <p className="muted" style={{ margin: 0 }}>
        قیمت‌ها و شرایط خرید به حساب تو بستگی دارد. مهمان کمپین دیگری با قیمت دیگری می‌بیند، پس
        نتیجه‌ای که نشان داده شود مال حساب تو نیست.
      </p>
      <Link className="button button--primary" to="/accounts">
        ورود با شماره موبایل
      </Link>
    </div>
  );
}
