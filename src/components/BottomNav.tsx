import { useLocation, useNavigate } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { format } from 'date-fns';

const NAV_ITEMS = [
  {
    label: '周计划',
    icon: <CalendarMonthIcon />,
    path: '/',
  },
  {
    label: '今日',
    icon: <TodayIcon />,
    path: '/day',
  },
  {
    label: '知识卡片',
    icon: <AutoStoriesIcon />,
    path: '/knowledge',
  },
  {
    label: '周回顾',
    icon: <AssessmentIcon />,
    path: '/review',
  },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current value based on path
  let currentValue = '/';
  const path = location.pathname;
  if (path.startsWith('/day/')) {
    currentValue = '/day';
  } else if (path === '/knowledge') {
    currentValue = '/knowledge';
  } else if (path === '/review') {
    currentValue = '/review';
  } else {
    currentValue = '/';
  }

  const handleNavigate = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === '/day') {
      navigate(`/day/${format(new Date(), 'yyyy-MM-dd')}`);
    } else {
      navigate(newValue);
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderTop: '1px solid',
        borderColor: 'divider',
        borderRadius: 0,
      }}
      elevation={3}
    >
      <BottomNavigation
        value={currentValue}
        onChange={handleNavigate}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            py: 0.5,
            fontSize: '0.7rem',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            '&.Mui-selected': {
              fontSize: '0.7rem !important',
            },
          },
        }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.label}
            label={item.label}
            icon={item.icon}
            value={item.path}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

export default BottomNav;
