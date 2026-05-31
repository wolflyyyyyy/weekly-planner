import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Rating,
  Tooltip,
  Card,
  CardContent,
  Button,
  Dialog,
  Slide,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { KnowledgeCard as KnowledgeCardType } from '../types';
import type { TransitionProps } from '@mui/material/transitions';

const ExpandTransition = Slide;


interface KnowledgeCardProps {
  card: KnowledgeCardType;
  onMasteryChange?: (cardId: string, newMastery: number) => void;
  onMarkMastered?: (cardId: string) => void;
  onEdit?: (card: KnowledgeCardType) => void;
  onDelete?: (cardId: string) => void;
  onChat?: (card: KnowledgeCardType) => void;
}

/** A flashcard-style knowledge card with flip animation and double-click expand. */
function KnowledgeCard({
  card,
  onMasteryChange,
  onMarkMastered,
  onEdit,
  onDelete,
  onChat,
}: KnowledgeCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
  };

  const handleClick = () => {
    // Single click: flip after short delay (to detect double-click)
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // Double click: expand
      setExpanded(true);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        handleFlip();
      }, 250);
    }
  };

  const handleCloseExpanded = () => {
    setExpanded(false);
  };

  return (
    <>
    <Card
      sx={{
        position: 'relative',
        height: 280,
        cursor: 'pointer',
        overflow: 'visible',
        bgcolor: 'transparent',
        boxShadow: 'none',
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        setExpanded(true);
      }}
    >
      {/* Perspective container */}
      <Box
        className="perspective-800"
        sx={{ width: '100%', height: '100%' }}
      >
        <Box className={`card-flip-inner${flipped ? ' flipped' : ''}`}>
          {/* Front face — Question */}
          <Card
            className="card-flip-front"
            sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardContent
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                p: 2.5,
                '&:last-child': { pb: 2.5 },
              }}
            >
              {/* Tags row */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  mb: 1.5,
                }}
              >
                {card.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.65rem',
                      bgcolor: '#EDE9FE',
                      color: '#7C3AED',
                      fontWeight: 500,
                    }}
                  />
                ))}
              </Box>

              {/* Question */}
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                ❓ {card.question}
              </Typography>

              {/* Footer */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {card.date} · {card.source}
                  {card.nextReviewDate && (
                    <> · 复习{card.nextReviewDate}</>
                  )}
                </Typography>
                <Tooltip title="翻转查看答案">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                  >
                    <FlipCameraAndroidIcon
                      sx={{ fontSize: 20, color: 'primary.main' }}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>

          {/* Back face — Answer */}
          <Card
            className="card-flip-back"
            sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#F5F3FF',
              overflow: 'hidden',
            }}
          >
            <CardContent
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                p: 2.5,
                '&:last-child': { pb: 2.5 },
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 600, mb: 1 }}
              >
                💡 答案
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: 'text.primary',
                  lineHeight: 1.6,
                  flex: 1,
                  overflow: 'auto',
                  whiteSpace: 'pre-line',
                  fontSize: '0.8rem',
                }}
              >
                {card.answer}
              </Typography>

              {/* Chat button */}
              {onChat && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChat(card);
                  }}
                  sx={{
                    mt: 1,
                    alignSelf: 'flex-start',
                    borderRadius: 3,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#7C3AED',
                    borderColor: '#DDD6FE',
                    '&:hover': { borderColor: '#7C3AED', bgcolor: '#F5F3FF' },
                  }}
                >
                  {card.chatHistory && card.chatHistory.length > 0
                    ? `查看讨论(${card.chatHistory.filter((m) => m.role === 'user').length})`
                    : '追问'}
                </Button>
              )}

              {/* Footer with mastery */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    掌握度:
                  </Typography>
                  <Rating
                    value={card.mastery}
                    max={3}
                    size="small"
                    onChange={(_, val) => {
                      if (val !== null && onMasteryChange) {
                        onMasteryChange(card.id, val);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      '& .MuiRating-iconFilled': { color: '#7C3AED' },
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {onEdit && (
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(card);
                        }}
                      >
                        <EditIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(card.id);
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 18, color: 'error.main' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onMarkMastered && card.mastery < 3 && (
                    <Tooltip title="标记为已掌握">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkMastered(card.id);
                        }}
                        sx={{ color: 'success.main' }}
                      >
                        <CheckIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="翻回问题">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlip();
                      }}
                    >
                      <FlipCameraAndroidIcon
                        sx={{ fontSize: 20, color: 'primary.main' }}
                      />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Card>

    {/* Expanded Dialog */}
    <Dialog
      open={expanded}
      onClose={handleCloseExpanded}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '85vh',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="primary.main">
          {flipped ? '💡 答案' : '❓ 问题'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="翻转">
            <IconButton
              size="small"
              onClick={() => setFlipped((p) => !p)}
            >
              <FlipCameraAndroidIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleCloseExpanded}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2.5,
          py: 2,
        }}
      >
        {/* Tags */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {card.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                bgcolor: '#EDE9FE',
                color: '#7C3AED',
                fontWeight: 500,
              }}
            />
          ))}
        </Box>

        {/* Question (always visible in expanded) */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: '#FAFAFA',
            border: '1px solid #E5E7EB',
            mb: 2,
          }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.6 }}>
            {card.question}
          </Typography>
        </Box>

        {/* Answer */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: '#F5F3FF',
            border: '1px solid #DDD6FE',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.primary',
              lineHeight: 1.7,
              whiteSpace: 'pre-line',
            }}
          >
            {card.answer}
          </Typography>
        </Box>

        {/* Chat summary if exists */}
        {card.chatSummary && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: '#FFF7ED',
              border: '1px solid #FED7AA',
            }}
          >
            <Typography variant="caption" fontWeight={600} color="#EA580C" sx={{ mb: 0.5, display: 'block' }}>
              讨论总结
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              {card.chatSummary}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Mastery */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            掌握度:
          </Typography>
          <Rating
            value={card.mastery}
            max={3}
            size="small"
            onChange={(_, val) => {
              if (val !== null && onMasteryChange) {
                onMasteryChange(card.id, val);
              }
            }}
            sx={{ '& .MuiRating-iconFilled': { color: '#7C3AED' } }}
          />
        </Box>

        {/* Buttons */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onChat && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                handleCloseExpanded();
                onChat(card);
              }}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#7C3AED',
                borderColor: '#DDD6FE',
                '&:hover': { borderColor: '#7C3AED', bgcolor: '#F5F3FF' },
              }}
            >
              {card.chatHistory && card.chatHistory.length > 0
                ? `查看讨论(${card.chatHistory.filter((m) => m.role === 'user').length})`
                : '追问'}
            </Button>
          )}
          {onEdit && (
            <Tooltip title="编辑">
              <IconButton
                size="small"
                onClick={() => {
                  handleCloseExpanded();
                  onEdit(card);
                }}
              >
                <EditIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="删除">
              <IconButton
                size="small"
                onClick={() => {
                  handleCloseExpanded();
                  onDelete(card.id);
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18, color: 'error.main' }} />
              </IconButton>
            </Tooltip>
          )}
          {onMarkMastered && card.mastery < 3 && (
            <Tooltip title="已掌握">
              <IconButton
                size="small"
                onClick={() => {
                  handleCloseExpanded();
                  onMarkMastered(card.id);
                }}
                sx={{ color: 'success.main' }}
              >
                <CheckIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Dialog>
    </>
  );
}

export default KnowledgeCard;
