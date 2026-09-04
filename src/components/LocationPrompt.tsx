import { Link } from 'react-router';

export default function LocationPrompt() {
  return (
    <div className="card stack">
      <b>اول موقعیت تحویل را مشخص کن</b>
      <p className="muted" style={{ margin: 0 }}>
        هر قیمت و هزینهٔ ارسالی به جایی که هستی بستگی دارد، پس بدون آن چیزی برای نشان دادن نیست.
      </p>
      <Link className="button button--primary" to="/settings">
        انتخاب موقعیت
      </Link>
    </div>
  );
}
