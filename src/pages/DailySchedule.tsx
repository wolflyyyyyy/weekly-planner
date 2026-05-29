import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  TimeBlock as TimeBlockType,
  HourlyCheckin,
  DAY_NAMES,
  DAY_LABELS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_COLORS,
} from '../types';
import {
  getWeekKey,
  getDayBlocks,
  saveDayBlocks,
  getCheckins,
  saveCheckin,
} from '../data/storage';

// Fixed time grid: 10:00 to 19:00
const HOURS = ['10', '11', '12', '13', '14', '15', '16', '17', '18'];

const CHECKIN_ITEMS = [
  '当前任务按计划推进',
  '注意力集中，无频繁打断',
  '产出符合预期质量',
];

function DailySchedule() {
  const { date: dateParam } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const dateStr = dateParam || format(new Date(), 'yyyy-MM-dd');
  const date = parseISO(dateStr);
  const weekKey = getWeekKey(date);

  // Day info
  const weekMonday = startOfWeek(date, { weekStartsOn: 1 });
  const dayIdx = Math.floor((date.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24));
  const dayName = DAY_NAMES[dayIdx] || 'Monday';
  const dayLabel = DAY_LABELS[dayName] || '';

  // Data state
  const [blocks, setBlocks] = useState<TimeBlockType[]>([]);
  const [checkins, setCheckins] = useState<HourlyCheckin[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Add task dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addHour, setAddHour] = useState('');
  const [addTask, setAddTask] = useState('');
  const [addType, setAddType] = useState<TimeBlockType['type']>('deep');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlockType | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState<TimeBlockType['type']>('deep');

  // Complete dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingBlock, setCompletingBlock] = useState<TimeBlockType | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  // Checkin dialog
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinHour, setCheckinHour] = useState('');
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinDone, setCheckinDone] = useState<boolean[]>([false, false, false]);

  // Load data
  useEffect(() => {
    const dayData = getDayBlocks(weekKey, dateStr);
    setBlocks(dayData?.blocks ?? []);
    setCheckins(dayData?.checkins ?? []);
    setLoaded(true);
  }, [dateStr, weekKey]);

  // Persist blocks
  const persistBlocks = (newBlocks: TimeBlockType[]) => {
    setBlocks(newBlocks);
    const dayData = getDayBlocks(weekKey, dateStr) || { blocks: [] };
    saveDayBlocks(weekKey, dateStr, { ...dayData, blocks: newBlocks });
  };

  // Navigation
  const goPrevDay = () => navigate(`/day/${format(addDays(date, -1), 'yyyy-MM-dd')}`);
  const goNextDay = () => navigate(`/day/${format(addDays(date, 1), 'yyyy-MM-dd')}`);
  const goToday = () => navigate(`/day/${format(new Date(), 'yyyy-MM-dd')}`);

  // Get blocks for a specific hour
  const getBlocksForHour = (hour: string): TimeBlockType[] => {
    return blocks.filter((b) => b.time.startsWith(`${hour}:`));
  };

  // Get checkin for a specific hour
  const getCheckinForHour = (hour: string): HourlyCheckin | undefined => {
    return checkins.find((c) => c.hour === hour);
  };

  // Add task
  const handleOpenAdd = (hour: string) => {
    setAddHour(hour);
    setAddTask('');
    setAddType('deep');
    setAddOpen(true);
  };

  const handleSaveAdd = () => {
    if (!addTask.trim()) return;
    const duration = addType === 'deep' ? 50 : addType === 'buffer' ? 40 : 10;
    const startMin = 0;
    const endMin = startMin + duration;
    const newBlock: TimeBlockType = {
      id: `${dayName}-${Date.now()}`,
      time: `${addHour}:${String(startMin).padStart(2, '0')}-${String(Number(addHour) + (endMin >= 60 ? 1 : 0)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
      type: addType,
      task: addTask.trim(),
      completed: false,
      note: '',
      modifications: [],
    };
    persistBlocks([...blocks, newBlock]);
    setAddOpen(false);
  };

  // Toggle complete
  const handleToggleComplete = (block: TimeBlockType) => {
    if (!block.completed) {
      setCompletingBlock(block);
      setCompleteNote('');
      setCompleteOpen(true);
    } else {
      const updated = blocks.map((b) =>
        b.id === block.id ? { ...b, completed: false, note: '' } : b
      );
      persistBlocks(updated);
    }
  };

  const handleSaveComplete = () => {
    if (!completingBlock) return;
    const updated = blocks.map((b) =>
      b.id === completingBlock.id ? { ...b, completed: true, note: completeNote } : b
    );
    persistBlocks(updated);
    setCompleteOpen(false);
  };

  // Edit block
  const handleEditBlock = (block: TimeBlockType) => {
    setEditingBlock(block);
    setEditTask(block.task);
    setEditTime(block.time);
    setEditType(block.type);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingBlock) return;
    const updatedBlock: TimeBlockType = {
      ...editingBlock,
      task: editTask,
      time: editTime,
      type: editType,
      modifications: [
        ...editingBlock.modifications,
        { time: new Date().toISOString(), original: editingBlock.task, new: editTask, reason: '手动调整' },
      ],
    };
    const updated = blocks.map((b) => (b.id === editingBlock.id ? updatedBlock : b));
    persistBlocks(updated);
    setEditOpen(false);
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    persistBlocks(blocks.filter((b) => b.id !== blockId));
  };

  // Checkin
  const handleOpenCheckin = (hour: string) => {
    const existing = getCheckinForHour(hour);
    setCheckinHour(hour);
    setCheckinDone(existing?.checked ?? [false, false, false]);
    setCheckinNote(existing?.note ?? '');
    setCheckinOpen(true);
  };

  const handleSaveCheckin = () => {
    const checkin: HourlyCheckin = {
      hour: checkinHour,
      checked: checkinDone,
      note: checkinNote,
      time: new Date().toISOString(),
    };
    saveCheckin(weekKey, dateStr, checkin);
    setCheckins((prev) => {
      const idx = prev.findIndex((c) => c.hour === checkinHour);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = checkin;
        return next;
      }
      return [...prev, checkin];
    });
    setCheckinOpen(false);
  };

  // Stats
  const completedCount = blocks.filter((b) => b.completed).length;
  const totalCount = blocks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const checkinCount = checkins.length;

  // Style for block type
  const getBlockColors = (type: TimeBlockType['type']) => {
    const map = {
      deep: { bg: '#EEF0FF', border: '#5B7FFF', text: '#5B7FFF' },
      buffer: { bg: '#FFF0F0', border: '#FF6B6B', text: '#FF6B6B' },
      break: { bg: '#F0FAF4', border: '#34D399', text: '#10B981' },
    };
    return map[type] || map.deep;
  };

  if (!loaded) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
        <IconButton onClick={() => navigate('/')} size="small">
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography variant="body1" fontWeight={600}>
          {format(date, 'yyyy年M月', { locale: zhCN })}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={goPrevDay}><ChevronLeftIcon fontSize="small" /></IconButton>
          <Button size="small" onClick={goToday} sx={{ minWidth: 'auto', px: 1, fontSize: '0.8rem', fontWeight: 700 }}>
            今天
          </Button>
          <IconButton size="small" onClick={goNextDay}><ChevronRightIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      {/* Date hero */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, px: 1 }}>
        <Typography variant="h2" fontWeight={800} color="primary.main" sx={{ lineHeight: 1 }}>
          {format(date, 'd')}
        </Typography>
        <Box>
          <Typography variant="body1" fontWeight={600}>{dayLabel}</Typography>
          <Typography variant="caption" color="text.secondary">
            {checkinCount > 0 ? `已打卡 ${checkinCount}/${HOURS.length} 小时` : '暂无打卡记录'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${completionPct}%`}
          size="small"
          color={completionPct >= 80 ? 'success' : completionPct >= 40 ? 'warning' : 'default'}
          sx={{ fontWeight: 700 }}
        />
        <Typography variant="caption" color="text.secondary">
          {completedCount}/{totalCount}
        </Typography>
      </Box>

      {/* Time grid */}
      <Card sx={{ borderRadius: 3, overflow: 'hidden' }} elevation={0}>
        {HOURS.map((hour, hourIdx) => {
          const hourBlocks = getBlocksForHour(hour);
          const checkin = getCheckinForHour(hour);
          const isLast = hourIdx === HOURS.length - 1;

          return (
            <Box key={hour}>
              {/* Hour row */}
              <Box sx={{ display: 'flex', minHeight: { xs: 64, sm: 72 } }}>
                {/* Time label column */}
                <Box
                  sx={{
                    width: { xs: 44, sm: 56 },
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 1.5,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#FAFAFA',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {hour}:00
                  </Typography>
                  {checkin && (
                    <Tooltip title="已打卡">
                      <Box sx={{ mt: 0.5, width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
                    </Tooltip>
                  )}
                </Box>

                {/* Content column */}
                <Box sx={{ flex: 1, px: { xs: 1, sm: 1.5 }, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {/* Existing blocks */}
                  {hourBlocks.map((block) => {
                    const colors = getBlockColors(block.type);
                    return (
                      <Box
                        key={block.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 0.75, sm: 1 },
                          px: { xs: 1, sm: 1.5 },
                          py: { xs: 0.75, sm: 1 },
                          borderRadius: 2,
                          bgcolor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          opacity: block.completed ? 0.6 : 1,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
                        }}
                        onClick={() => handleToggleComplete(block)}
                      >
                        {/* Check circle */}
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            border: `2px solid ${block.completed ? '#10B981' : colors.border}`,
                            bgcolor: block.completed ? '#10B981' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'white',
                            fontSize: '0.7rem',
                            transition: 'all 0.2s',
                          }}
                        >
                          {block.completed ? '✓' : ''}
                        </Box>

                        {/* Task info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{
                              textDecoration: block.completed ? 'line-through' : 'none',
                              color: block.completed ? 'text.disabled' : 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {block.task}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                            <Typography variant="caption" color={colors.text} fontWeight={600}>
                              {block.time}
                            </Typography>
                            <Chip
                              label={BLOCK_TYPE_LABELS[block.type]}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: `${BLOCK_TYPE_COLORS[block.type]}15`,
                                color: BLOCK_TYPE_COLORS[block.type],
                                fontWeight: 600,
                              }}
                            />
                            {block.note && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                💬
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Actions */}
                        <IconButton
                          size="small"
                          sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                          onClick={(e) => { e.stopPropagation(); handleEditBlock(block); }}
                        >
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    );
                  })}

                  {/* Empty state: add button */}
                  {hourBlocks.length === 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 1,
                        borderRadius: 2,
                        border: '1px dashed',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: 'primary.main', bgcolor: '#F8F7FF' },
                      }}
                      onClick={() => handleOpenAdd(hour)}
                    >
                      <AddIcon sx={{ fontSize: 16, color: 'text.disabled', mr: 0.5 }} />
                      <Typography variant="caption" color="text.disabled">
                        添加任务
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Checkin button column */}
                <Box
                  sx={{
                    width: { xs: 36, sm: 44 },
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    pt: 1.5,
                  }}
                >
                  <Tooltip title={checkin ? '查看打卡' : '打卡本小时'}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenCheckin(hour)}
                      sx={{
                        bgcolor: checkin ? '#ECFDF5' : 'transparent',
                        border: '1px solid',
                        borderColor: checkin ? '#10B981' : 'divider',
                        '&:hover': { bgcolor: checkin ? '#D1FAE5' : '#F5F5F5' },
                      }}
                    >
                      <AccessTimeIcon
                        sx={{
                          fontSize: 16,
                          color: checkin ? '#10B981' : 'text.disabled',
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Divider */}
              {!isLast && <Divider sx={{ borderColor: '#F3F4F6' }} />}
            </Box>
          );
        })}
      </Card>

      {/* Stats bar */}
      <Card
        sx={{ mt: 2, borderRadius: 2, background: 'linear-gradient(135deg, #667eea11, #764ba211)' }}
        elevation={0}
      >
        <CardContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.5,
            '&:last-child': { pb: 1.5 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip label={`${completionPct}%`} size="small" color={completionPct >= 80 ? 'success' : completionPct >= 40 ? 'warning' : 'default'} sx={{ fontWeight: 700 }} />
            <Typography variant="body2" color="text.secondary">
              {completedCount}/{totalCount} 项完成 · {checkinCount}/{HOURS.length} 小时打卡
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* ===== Add Task Dialog ===== */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          <AddIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
          添加任务 · {addHour}:00
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="任务描述"
            value={addTask}
            onChange={(e) => setAddTask(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            placeholder="这个小时要做什么？"
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
              任务类型
            </Typography>
            <ToggleButtonGroup value={addType} exclusive onChange={(_, val) => val && setAddType(val)} size="small" fullWidth>
              <ToggleButton value="deep" sx={{ fontSize: '0.78rem' }}>深度工作</ToggleButton>
              <ToggleButton value="buffer" sx={{ fontSize: '0.78rem' }}>缓冲</ToggleButton>
              <ToggleButton value="break" sx={{ fontSize: '0.78rem' }}>休息</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>取消</Button>
          <Button onClick={handleSaveAdd} variant="contained" sx={{ borderRadius: 2 }} disabled={!addTask.trim()}>添加</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Complete Dialog ===== */}
      <Dialog open={completeOpen} onClose={() => setCompleteOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          <CheckCircleOutlineIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'success.main', fontSize: 24 }} />
          标记完成
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {completingBlock && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: getBlockColors(completingBlock.type).bg, borderLeft: `3px solid ${getBlockColors(completingBlock.type).border}`, mb: 2 }}>
              <Typography variant="caption" fontWeight={600} color={getBlockColors(completingBlock.type).text}>{completingBlock.time}</Typography>
              <Typography variant="body2" fontWeight={600}>{completingBlock.task}</Typography>
            </Box>
          )}
          <TextField label="完成备注（可选）" value={completeNote} onChange={(e) => setCompleteNote(e.target.value)} size="small" fullWidth multiline rows={2} placeholder="记录收获、遇到的问题..." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCompleteOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>取消</Button>
          <Button onClick={handleSaveComplete} variant="contained" color="success" sx={{ borderRadius: 2 }}>确认完成</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Edit Dialog ===== */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          <EditIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
          编辑任务
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="时间" value={editTime} onChange={(e) => setEditTime(e.target.value)} size="small" fullWidth />
          <TextField label="任务描述" value={editTask} onChange={(e) => setEditTask(e.target.value)} size="small" fullWidth multiline rows={2} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>任务类型</Typography>
            <ToggleButtonGroup value={editType} exclusive onChange={(_, val) => val && setEditType(val)} size="small" fullWidth>
              <ToggleButton value="deep" sx={{ fontSize: '0.78rem' }}>深度工作</ToggleButton>
              <ToggleButton value="buffer" sx={{ fontSize: '0.78rem' }}>缓冲</ToggleButton>
              <ToggleButton value="break" sx={{ fontSize: '0.78rem' }}>休息</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {editingBlock && (
            <Button
              color="error"
              size="small"
              onClick={() => { handleDeleteBlock(editingBlock.id); setEditOpen(false); }}
              sx={{ mr: 'auto' }}
            >
              删除
            </Button>
          )}
          <Button onClick={() => setEditOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>取消</Button>
          <Button onClick={handleSaveEdit} variant="contained" sx={{ borderRadius: 2 }}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Checkin Dialog ===== */}
      <Dialog open={checkinOpen} onClose={() => setCheckinOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          🕐 {checkinHour}:00 - 小时打卡
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            回顾 {checkinHour}:00-{checkinHour}:59 这一个小时：
          </Typography>
          {CHECKIN_ITEMS.map((item, idx) => (
            <Box
              key={idx}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => {
                const next = [...checkinDone];
                next[idx] = !next[idx];
                setCheckinDone(next);
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 1,
                  border: '2px solid',
                  borderColor: checkinDone[idx] ? 'success.main' : 'divider',
                  bgcolor: checkinDone[idx] ? 'success.main' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s',
                }}
              >
                {checkinDone[idx] ? '✓' : ''}
              </Box>
              <Typography variant="body2">{item}</Typography>
            </Box>
          ))}
          <Divider />
          <TextField
            label="备注"
            value={checkinNote}
            onChange={(e) => setCheckinNote(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="这小时做了什么、遇到什么问题..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCheckinOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>取消</Button>
          <Button onClick={handleSaveCheckin} variant="contained" sx={{ borderRadius: 2 }}>
            {getCheckinForHour(checkinHour) ? '更新打卡' : '完成打卡'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DailySchedule;
