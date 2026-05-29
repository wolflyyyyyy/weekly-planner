import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Collapse,
  Tab,
  Tabs,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { signIn, signUp } from '../data/storage';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0); // 0 = login, 1 = register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    setError('');

    const fn = tab === 0 ? signIn : signUp;
    const result = await fn(email.trim(), password);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CloudSyncIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>
              云同步登录
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              登录后数据自动同步到云端，多设备共享
            </Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setError(''); }}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab label="登录" />
            <Tab label="注册" />
          </Tabs>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          </Collapse>

          <TextField
            label="邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            fullWidth
            size="small"
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handleSubmit}
            disabled={loading}
            sx={{ py: 1.2, fontWeight: 600, borderRadius: 2 }}
          >
            {loading ? '处理中...' : tab === 0 ? '登录' : '注册'}
          </Button>

          <Button
            fullWidth
            sx={{ mt: 1.5, color: 'text.secondary', fontSize: '0.85rem' }}
            onClick={() => navigate('/')}
          >
            跳过，使用本地模式
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
