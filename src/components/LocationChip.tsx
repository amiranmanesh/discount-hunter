import { useNavigate } from 'react-router';
import { useSettings } from '../store/settings';

export default function LocationChip() {
  const location = useSettings((state) => state.location);
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`chip${location ? '' : ' warn'}`}
      onClick={() => navigate('/settings')}
      title="تغییر موقعیت تحویل"
    >
      <span aria-hidden="true">◎</span>
      {location ? location.label : 'موقعیت تنظیم نشده'}
    </button>
  );
}
