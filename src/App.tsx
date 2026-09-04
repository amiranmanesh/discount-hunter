import { Navigate, Route, Routes } from 'react-router';
import BottomNav from './components/BottomNav';
import DealsPage from './routes/DealsPage';
import SearchPage from './routes/SearchPage';
import AccountsPage from './routes/AccountsPage';
import SettingsPage from './routes/SettingsPage';
import LocationChip from './components/LocationChip';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="wrap">
          <span className="brand">
            <img src="/icons/icon-192.png" alt="" width={26} height={26} />
            شکارچی تخفیف
          </span>
          <div style={{ marginInlineStart: 'auto' }}>
            <LocationChip />
          </div>
        </div>
      </header>

      <BottomNav />

      <main className="app-main">
        <div className="wrap">
          <Routes>
            <Route path="/" element={<DealsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
