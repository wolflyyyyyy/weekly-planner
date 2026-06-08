import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Alert,
  Collapse,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import SendIcon from '@mui/icons-material/Send';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import LogoutIcon from '@mui/icons-material/Logout';
import { AISettings, DEFAULT_AI_SETTINGS } from '../types';
import { loadSettings, saveSettings, getAuthUser, signOut } from '../data/storage';
import { testApiConnection, sendChatMessage } from '../data/aiService';
import { isOnline } from '../lib/supabase';
import {
  getRecentUsage,
  getTotalUsage,
  clearUsage,
  type DailyUsage,
} from '../data/tokenUsage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AISettings>(loadSettings);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Auth state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    if (isOnline) {
      getAuthUser().then((u) => setUserEmail(u?.email ?? null));
    }
  }, []);

  // Token usage state
  const [usageLog, setUsageLog] = useState(() => getRecentUsage(7));
  const [totalUsage, setTotalUsage] = useState(() => getTotalUsage());
  const refreshUsage = () => {
    setUsageLog(getRecentUsage(7));
    setTotalUsage(getTotalUsage());
  };

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = () => {
    setSaving(true);
    saveSettings(settings);
    setTimeout(() => {
      setSaving(false);
      setAlert({ type: 'success', msg: '设置已保存' });
    }, 300);
  };

  const handleTest = async () => {
    setTesting(true);
    setAlert(null);
    const result = await testApiConnection(settings);
    setTesting(false);
    if (result.ok) {
      setAlert({ type: 'success', msg: '连接成功！API 可用。' });
    } else {
      setAlert({ type: 'error', msg: `连接失败：${result.error}` });
    }
  };

  const update = (field: keyof AISettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Chat: send message
  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg = { role: 'user' as const, content: text };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      // Use current settings (not necessarily saved yet)
      const currentSettings = { ...DEFAULT_AI_SETTINGS, ...settings };
      const reply = await sendChatMessage(updatedMessages, currentSettings);
      setChatMessages([...updatedMessages, { role: 'assistant', content: reply }]);
      refreshUsage();
    } catch (err) {
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: `错误：${String(err)}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleLogout = async () => {
    await signOut();
    setUserEmail(null);
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        AI 设置
      </Typography>

      {/* Cloud Sync Status */}
      {isOnline && (
        <Card sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloudSyncIcon sx={{ color: userEmail ? 'success.main' : 'text.disabled' }} />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {userEmail ? '云同步已开启' : '未登录'}
                </Typography>
                {userEmail && (
                  <Typography variant="caption" color="text.secondary">{userEmail}</Typography>
                )}
              </Box>
            </Box>
            {userEmail ? (
              <Button size="small" color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
                退出
              </Button>
            ) : (
              <Button size="small" variant="outlined" onClick={() => navigate('/login')}>
                登录同步
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isOnline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          未配置 Supabase，数据仅保存在本地。配置 .env 后可启用云同步。
        </Alert>
      )}

      {/* Token Usage */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Token 使用统计
            </Typography>
            {totalUsage.totalTokens > 0 && (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  if (confirm('确定清除所有统计数据？')) {
                    clearUsage();
                    refreshUsage();
                  }
                }}
                sx={{ fontSize: '0.7rem' }}
              >
                清除
              </Button>
            )}
          </Box>

          {totalUsage.totalTokens === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              暂无使用记录，调用 API 后自动统计
            </Typography>
          ) : (
            <>
              {/* Summary row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2, textAlign: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {(totalUsage.totalTokens / 1000).toFixed(1)}k
                  </Typography>
                  <Typography variant="caption" color="text.secondary">累计 Token</Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {totalUsage.callCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">API 调用次数</Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} color="secondary.main">
                    {totalUsage.callCount > 0 ? Math.round(totalUsage.totalTokens / totalUsage.callCount) : 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">平均/次</Typography>
                </Box>
              </Box>

              {/* 7-day bar chart */}
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                近 7 天用量
              </Typography>
              <Box sx={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageLog}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      fontSize={10}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [`${value} tokens`, '用量']}
                      labelFormatter={(label: string) => label}
                    />
                    <Bar dataKey="totalTokens" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {/* Today detail */}
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const todayData = usageLog.find((d) => d.date === today);
                if (!todayData || todayData.totalTokens === 0) return null;
                return (
                  <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F8F7FF', borderRadius: 2 }}>
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      今日详情
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        输入: {todayData.promptTokens}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        输出: {todayData.completionTokens}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        合计: {todayData.totalTokens}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        调用: {todayData.callCount}次
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      <Collapse in={!!alert}>
        <Alert
          severity={alert?.type}
          sx={{ mb: 2 }}
          onClose={() => setAlert(null)}
        >
          {alert?.msg}
        </Alert>
      </Collapse>

      {/* API Configuration */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            API 配置
          </Typography>

          <TextField
            label="API 端点"
            placeholder="https://api.deepseek.com"
            value={settings.apiEndpoint}
            onChange={(e) => update('apiEndpoint', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            helperText="填 API 地址，如 https://api.deepseek.com。第三方代理需填到 /v1，如 https://xxx.com/anthropic/v1"
          />

          <TextField
            label="API Key"
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="模型"
            placeholder="gpt-4o"
            value={settings.model}
            onChange={(e) => update('model', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            helperText="如 gpt-4o、deepseek-chat、qwen-plus 等"
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              size="small"
            >
              {saving ? '保存中...' : '保存设置'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<WifiTetheringIcon />}
              onClick={handleTest}
              disabled={testing}
              size="small"
            >
              {testing ? '测试中...' : '测试连接'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Prompt Configuration */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            提示词设置
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            自定义 AI 生成计划时的风格偏好。系统会自动附加结构化输出格式要求。
          </Typography>

          <TextField
            label="风格提示词"
            value={settings.systemPrompt}
            onChange={(e) => update('systemPrompt', e.target.value)}
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            size="small"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            输出结构说明
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            AI 会严格按照以下 JSON 结构输出，直接转换为每日日程：
          </Typography>
          <Box
            sx={{
              bgcolor: '#1e1e2e',
              color: '#cdd6f4',
              p: 1.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              overflowX: 'auto',
              whiteSpace: 'pre',
              lineHeight: 1.6,
            }}
          >
{`{
  "Monday": [
    {"id": "Monday-01", "time": "10:00-10:50",
     "type": "deep", "task": "梳理PRD框架"},
    {"id": "Monday-02", "time": "10:50-11:00",
     "type": "break", "task": "休息"}
  ],
  "Tuesday": [...],
  ...
}`}
          </Box>

          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="deep = 深度工作 (50min)" size="small" color="primary" variant="outlined" />
            <Chip label="buffer = 缓冲 (40min)" size="small" color="warning" variant="outlined" />
            <Chip label="break = 休息 (10-40min)" size="small" color="success" variant="outlined" />
          </Box>
        </CardContent>
      </Card>

      {/* Chat Test */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            API 对话测试
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            发一条消息测试 API 是否正常工作。使用上方保存前的配置。
          </Typography>

          {/* Message list */}
          <Box
            sx={{
              maxHeight: 360,
              overflowY: 'auto',
              bgcolor: '#f9fafb',
              borderRadius: 1,
              p: 1.5,
              mb: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {chatMessages.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                发送一条消息试试...
              </Typography>
            )}
            {chatMessages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    ...(msg.role === 'user'
                      ? { bgcolor: '#7C3AED', color: 'white', borderBottomRightRadius: 4 }
                      : { bgcolor: 'white', color: 'text.primary', border: '1px solid', borderColor: 'divider', borderBottomLeftRadius: 4 }),
                  }}
                >
                  {msg.content}
                </Box>
              </Box>
            ))}
            {chatLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  AI 思考中...
                </Typography>
              </Box>
            )}
            <div ref={chatEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
              placeholder="输入消息..."
              size="small"
              fullWidth
              disabled={chatLoading}
            />
            <Button
              variant="contained"
              onClick={handleChatSend}
              disabled={chatLoading || !chatInput.trim()}
              sx={{ minWidth: 48, px: 1.5 }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
