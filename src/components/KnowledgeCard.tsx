import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Rating,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { KnowledgeCard as KnowledgeCardType } from '../types';

interface KnowledgeCardProps {
  card: KnowledgeCardType;
  onMasteryChange?: (cardId: string, newMastery: number) => void;
  onMarkMastered?: (cardId: string) => void;
  onEdit?: (card: KnowledgeCardType) => void;
  onDelete?: (cardId: string) => void;
}

/** A flashcard-style knowledge card with flip animation. */
function KnowledgeCard({
  card,
  onMasteryChange,
  onMarkMastered,
  onEdit,
  onDelete,
}: KnowledgeCardProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
  };

  return (
    <Card
      sx={{
        position: 'relative',
        height: 240,
        cursor: 'pointer',
        overflow: 'visible',
        bgcolor: 'transparent',
        boxShadow: 'none',
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

              {/* Footer with mastery */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1.5,
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
  );
}

export default KnowledgeCard;
