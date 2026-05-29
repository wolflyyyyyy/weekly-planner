import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box, Container, IconButton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

/** App shell with header and bottom navigation. */
function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
          <AutoAwesomeIcon
            sx={{ mr: 1, color: 'primary.main', fontSize: 28 }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            知行合一
          </Typography>
          <Typography
            variant="body2"
            sx={{ ml: 1, color: 'text.secondary', fontWeight: 400 }}
          >
            工作流
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            size="small"
            onClick={() => navigate('/settings')}
            sx={{ color: 'text.secondary' }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          pb: 8, // space for bottom nav
          overflow: 'auto',
        }}
      >
        <Container maxWidth="md" sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
          {children}
        </Container>
      </Box>

      {/* Bottom navigation */}
      <BottomNav />
    </Box>
  );
}

export default Layout;
