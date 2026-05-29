import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  TextField,
  Button,
  CircularProgress,
  Slide,
  Chip,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import React from 'react';
import { KnowledgeCard as KnowledgeCardType, ChatMessage, AISettings } from '../types';
import { sendCardChatMessage, generateChatSummary } from '../data/aiService';

const SlideUpTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface CardChatDialogProps {
  open: boolean;
  card: KnowledgeCardType;
  settings: AISettings;
  onClose: (updatedCard: KnowledgeCardType) => void;
}

function CardChatDialog({ open, card, settings, onClose }: CardChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with existing chat history
  useEffect(() => {
    if (open) {
      setMessages(card.chatHistory || []);
      setEnded(!!card.chatSummary);
      setCardCollapsed(false);
      setInput('');
    }
  }, [open, card]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      time: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendCardChatMessage(card, messages, text, settings);
      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: reply,
        time: new Date().toISOString(),
      };
      setMessages([...newMessages, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `错误：${err instanceof Error ? err.message : String(err)}`,
        time: new Date().toISOString(),
      };
      setMessages([...newMessages, errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleEndChat = async () => {
    if (messages.length === 0) {
      onClose({ ...card, chatHistory: [], chatSummary: '' });
      return;
    }

    setEnding(true);
    try {
      const summary = await generateChatSummary(card, messages, settings);
      const summaryMsg: ChatMessage = {
        role: 'assistant',
        content: `📋 讨论总结：${summary}`,
        time: new Date().toISOString(),
      };
      const finalMessages = [...messages, summaryMsg];
      setMessages(finalMessages);
      setEnded(true);

      const updatedCard: KnowledgeCardType = {
        ...card,
        chatHistory: finalMessages,
        chatSummary: summary,
      };
      onClose(updatedCard);
    } catch {
      const updatedCard: KnowledgeCardType = {
        ...card,
        chatHistory: messages,
        chatSummary: '',
      };
      onClose(updatedCard);
    } finally {
      setEnding(false);
    }
  };

  const handleClose = () => {
    const updatedCard: KnowledgeCardType = {
      ...card,
      chatHistory: messages.length > 0 ? messages : card.chatHistory,
      chatSummary: card.chatSummary || (ended ? messages[messages.length - 1]?.content.replace('📋 讨论总结：', '') : ''),
    };
    onClose(updatedCard);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={handleClose}
      TransitionComponent={SlideUpTransition}
    >
      {/* Top Bar */}
      <AppBar
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 52, sm: 64 } }}>
          <IconButton edge="start" onClick={handleClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            sx={{
              flex: 1,
              ml: 1,
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: { xs: '0.9rem', sm: '1rem' },
            }}
          >
            {card.question}
          </Typography>
          {!ended && messages.length > 0 && (
            <Button
              size="small"
              color="error"
              onClick={handleEndChat}
              disabled={ending}
              startIcon={ending ? <CircularProgress size={14} /> : <StopIcon />}
              sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
            >
              结束
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Spacer for AppBar */}
      <Toolbar sx={{ minHeight: { xs: 52, sm: 64 } }} />

      {/* Collapsible Card Context */}
      <Box
        onClick={() => setCardCollapsed(!cardCollapsed)}
        sx={{
          cursor: 'pointer',
          bgcolor: '#F8F7FF',
          borderBottom: '1px solid',
          borderColor: '#EDE9FE',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="primary.main" fontWeight={600}>
            📌 卡片知识
          </Typography>
          {!cardCollapsed && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                Q: {card.question}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                A: {card.answer}
              </Typography>
            </Box>
          )}
        </Box>
        <IconButton size="small" sx={{ mt: -0.5 }}>
          {cardCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: '#FAFAFA',
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              opacity: 0.6,
            }}
          >
            <Typography variant="h3">💬</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              针对这张卡片的内容提问或讨论
              <br />
              AI 会基于卡片知识回答
            </Typography>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                maxWidth: '85%',
                px: 2,
                py: 1.25,
                borderRadius: msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                bgcolor: msg.role === 'user' ? '#7C3AED' : 'white',
                color: msg.role === 'user' ? 'white' : 'text.primary',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: msg.role === 'assistant' ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                  fontSize: '0.875rem',
                }}
              >
                {msg.content}
              </Typography>
            </Box>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              AI 思考中...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Bar */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'white',
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
        }}
      >
        <TextField
          inputRef={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={ended ? '对话已结束' : '输入你的问题...'}
          size="small"
          fullWidth
          multiline
          maxRows={4}
          disabled={ended}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              fontSize: '0.9rem',
            },
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!input.trim() || loading || ended}
          sx={{
            bgcolor: input.trim() && !ended ? '#7C3AED' : 'transparent',
            color: input.trim() && !ended ? 'white' : 'text.disabled',
            '&:hover': {
              bgcolor: input.trim() && !ended ? '#5B21B6' : 'transparent',
            },
            width: 40,
            height: 40,
            flexShrink: 0,
          }}
        >
          <SendIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
    </Dialog>
  );
}

export default CardChatDialog;
