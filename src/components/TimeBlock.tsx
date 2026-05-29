import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditIcon from '@mui/icons-material/Edit';
import {
  TimeBlock as TimeBlockType,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_COLORS,
  BLOCK_TYPE_BG,
} from '../types';

interface TimeBlockProps {
  block: TimeBlockType;
  onClick?: () => void;
  onToggleComplete?: () => void;
  onEdit?: () => void;
  compact?: boolean;
}

/** Renders a single time block as a colored card. */
function TimeBlock({
  block,
  onClick,
  onToggleComplete,
  onEdit,
  compact = false,
}: TimeBlockProps) {
  const color = BLOCK_TYPE_COLORS[block.type];
  const bg = BLOCK_TYPE_BG[block.type];
  const label = BLOCK_TYPE_LABELS[block.type];

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        bgcolor: bg,
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
        p: compact ? 1 : 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        opacity: block.completed ? 0.7 : 1,
        '&:hover': onClick
          ? {
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transform: 'translateY(-1px)',
            }
          : {},
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color,
              fontSize: compact ? '0.65rem' : '0.7rem',
              bgcolor: 'white',
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            {block.time}
          </Typography>
          <Chip
            label={label}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              bgcolor: color,
              color: 'white',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {onEdit && (
            <Tooltip title="编辑">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                sx={{ p: 0.25 }}
              >
                <EditIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          )}
          {onToggleComplete && (
            <Tooltip title={block.completed ? '标记未完成' : '标记完成'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete();
                }}
                sx={{ p: 0.25 }}
              >
                {block.completed ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                ) : (
                  <RadioButtonUncheckedIcon
                    sx={{ fontSize: 18, color: 'text.secondary' }}
                  />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Task description */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          color: 'text.primary',
          textDecoration: block.completed ? 'line-through' : 'none',
          fontSize: compact ? '0.78rem' : '0.85rem',
          lineHeight: 1.4,
        }}
      >
        {block.task}
      </Typography>

      {/* Note if exists */}
      {block.note && !compact && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: 'text.secondary',
            fontStyle: 'italic',
          }}
        >
          📝 {block.note}
        </Typography>
      )}

      {/* Modification count badge */}
      {block.modifications.length > 0 && (
        <Chip
          label={`${block.modifications.length}次调整`}
          size="small"
          sx={{
            mt: 0.75,
            height: 18,
            fontSize: '0.6rem',
            bgcolor: 'rgba(245, 158, 11, 0.15)',
            color: 'secondary.dark',
          }}
        />
      )}
    </Box>
  );
}

export default TimeBlock;
