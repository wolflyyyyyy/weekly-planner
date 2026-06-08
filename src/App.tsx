import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import WeeklyPlanner from './pages/WeeklyPlanner';
import DailySchedule from './pages/DailySchedule';
import KnowledgeCards from './pages/KnowledgeCards';
import WeeklyReview from './pages/WeeklyReview';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { getAuthUser, setCurrentUser, syncFromCloud } from './data/storage';
import { syncUsageFromCloud } from './data/tokenUsage';
import { isOnline } from './lib/supabase';

function App() {
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      if (isOnline) {
        const user = await getAuthUser();
        if (user) {
          setCurrentUser(user.id);
          await syncFromCloud();
          await syncUsageFromCloud();
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<WeeklyPlanner />} />
        <Route path="/day/:date" element={<DailySchedule key={location.pathname} />} />
        <Route path="/knowledge" element={<KnowledgeCards />} />
        <Route path="/review" element={<WeeklyReview />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Layout>
  );
}

export default App;
