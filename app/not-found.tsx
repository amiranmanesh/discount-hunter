import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card stack page-narrow">
      <b>این صفحه وجود ندارد</b>
      <p className="muted" style={{ margin: 0 }}>
        شاید نشانی را دستی تایپ کرده‌ای، یا از نسخهٔ قدیمی برنامه آمده‌ای.
      </p>
      <Link className="button button--primary" href="/">
        برگرد به تخفیف‌ها
      </Link>
    </div>
  );
}
