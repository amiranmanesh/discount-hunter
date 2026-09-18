'use client';

import { usePwa } from '../pwa/state';

/**
 * The two things an installed app has to say on its own, since there is no
 * browser around it to say them: that it is offline, and that a new version
 * is ready.
 */
export default function AppStatus() {
  const online = usePwa((state) => state.online);
  const updateReady = usePwa((state) => state.updateReady);

  if (!online) {
    return (
      <div className="app-toast app-toast--offline" role="status">
        <span>اینترنت قطع است؛ قیمت‌ها تا وصل شدن دوباره به‌روز نمی‌شوند.</span>
      </div>
    );
  }

  if (updateReady) {
    return (
      <div className="app-toast" role="status">
        <span>نسخهٔ تازهٔ برنامه آماده است.</span>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          بارگذاری دوباره
        </button>
      </div>
    );
  }

  return null;
}
