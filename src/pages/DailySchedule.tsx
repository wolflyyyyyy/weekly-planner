import { useState, useEffect, useRef, useCallback } from 'react';
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
  Slider,
  Collapse,
  Alert,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
  TimeBudget,
  DEFAULT_BUDGET,
  ALL_DAY_NAMES,
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
  saveDailySummary,
  getDailySummary,
  addKnowledgeCard,
  loadSettings,
  getGoals,
  getScheduleSource,
} from '../data/storage';
import { generateKnowledgeCardWithAI, generateDayScheduleWithAI } from '../data/aiService';
import type { KnowledgeCard } from '../types';

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
  const dayName = ALL_DAY_NAMES[dayIdx] || 'Monday';
  const dayLabel = DAY_LABELS[dayName] || '';

  // Data state
  const [blocks, setBlocks] = useState<TimeBlockType[]>([]);
  const [checkins, setCheckins] = useState<HourlyCheckin[]>([]);
  const [dailySummary, setDailySummary] = useState('');
  const [todayGoal, setTodayGoal] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [genCardLoading, setGenCardLoading] = useState(false);
  const [scheduleSource, setScheduleSource] = useState<'ai' | 'template' | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Daily planning state
  const [dayGoal, setDayGoal] = useState('');
  const [dayBudget, setDayBudget] = useState<TimeBudget>({ ...DEFAULT_BUDGET });
  const [dayPlanLoading, setDayPlanLoading] = useState(false);
  const [dayPlanExpanded, setDayPlanExpanded] = useState(false);

  // Track the current date key to detect navigation during async ops
  const dateKeyRef = useRef(dateStr);
  useEffect(() => {
    dateKeyRef.current = dateStr;
  }, [dateStr]);

  // Current hour for highlighting
  const now = new Date();
  const isToday = dateStr === format(now, 'yyyy-MM-dd');
  const currentHour = String(now.getHours());

  // Refs for hour rows (for auto-scroll)
  const hourRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrolledRef = useRef(false);

  // Add task dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addHour, setAddHour] = useState('10');
  const [addStartM, setAddStartM] = useState(0);
  const [addDuration, setAddDuration] = useState(60);
  const [addTask, setAddTask] = useState('');
  const [addType, setAddType] = useState<TimeBlockType['type']>('deep');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlockType | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editType, setEditType] = useState<TimeBlockType['type']>('deep');
  const [editStartH, setEditStartH] = useState(10);
  const [editStartM, setEditStartM] = useState(0);
  const [editDuration, setEditDuration] = useState(60);

  // Complete dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingBlock, setCompletingBlock] = useState<TimeBlockType | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  // Checkin dialog
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinHour, setCheckinHour] = useState('');
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinDone, setCheckinDone] = useState<boolean[]>([false, false, false]);

  // Drag and drop state
  const [draggingBlock, setDraggingBlock] = useState<TimeBlockType | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const dayData = getDayBlocks(weekKey, dateStr);
    const loadedBlocks = dayData?.blocks ?? [];
    console.log(`[Daily] 加载 ${dateStr} (${dayName}), weekKey=${weekKey}, blocks=${loadedBlocks.length}`);
    setBlocks(loadedBlocks);
    setCheckins(dayData?.checkins ?? []);
    setDailySummary(getDailySummary(weekKey, dateStr));

    // Load today's goal from weekly goals
    const goals = getGoals(weekKey);
    setTodayGoal(goals[dayName] || '');

    // Load schedule generation source
    const src = getScheduleSource(weekKey);
    setScheduleSource(src.source ?? null);
    setScheduleError(src.error ?? null);

    setLoaded(true);
  }, [dateStr, weekKey, dayName]);

  // Auto-scroll to current hour on mount (only when viewing today)
  useEffect(() => {
    if (!loaded || scrolledRef.current) return;
    if (isToday && HOURS.includes(currentHour)) {
      scrolledRef.current = true;
      setTimeout(() => {
        hourRefs.current[currentHour]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);
    }
  }, [loaded, isToday, currentHour]);

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
    setAddStartM(0);
    setAddDuration(60);
    setAddTask('');
    setAddType('deep');
    setAddOpen(true);
  };

  const handleSaveAdd = () => {
    if (!addTask.trim()) return;
    const sH = Number(addHour), sM = addStartM;
    const eTotal = sH * 60 + sM + addDuration;
    const eH = Math.floor(eTotal / 60), eM = eTotal % 60;
    const newBlock: TimeBlockType = {
      id: `${dayName}-${Date.now()}`,
      time: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}-${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
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

  // Parse time string "10:00-11:00" into structured fields
  const parseTimeFields = (timeStr: string) => {
    const m = timeStr.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (m) {
      const sH = parseInt(m[1]), sM = parseInt(m[2]);
      const eH = parseInt(m[3]), eM = parseInt(m[4]);
      return { startH: sH, startM: sM, duration: (eH * 60 + eM) - (sH * 60 + sM) };
    }
    return { startH: 10, startM: 0, duration: 60 };
  };

  // Build time string from structured fields
  const buildTimeStr = (sH: number, sM: number, dur: number) => {
    const eTotal = sH * 60 + sM + dur;
    const eH = Math.floor(eTotal / 60), eM = eTotal % 60;
    return `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}-${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  };

  // Edit block
  const handleEditBlock = (block: TimeBlockType) => {
    setEditingBlock(block);
    setEditTask(block.task);
    setEditType(block.type);
    const { startH, startM, duration } = parseTimeFields(block.time);
    setEditStartH(startH);
    setEditStartM(startM);
    setEditDuration(duration);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingBlock) return;
    const newTime = buildTimeStr(editStartH, editStartM, editDuration);
    const updatedBlock: TimeBlockType = {
      ...editingBlock,
      task: editTask,
      time: newTime,
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

  // Split block: shorten current to 30min, open add dialog for the freed slot
  const handleSplitBlock = () => {
    if (!editingBlock || editDuration <= 30) return;
    const newDuration = 30;
    const newTime = buildTimeStr(editStartH, editStartM, newDuration);
    const updatedBlock: TimeBlockType = {
      ...editingBlock,
      time: newTime,
      type: editType,
      task: editTask,
      modifications: [
        ...editingBlock.modifications,
        { time: new Date().toISOString(), original: editingBlock.time, new: newTime, reason: '拆分为30分钟' },
      ],
    };
    const updated = blocks.map((b) => (b.id === editingBlock.id ? updatedBlock : b));
    persistBlocks(updated);
    setEditOpen(false);
    // Open add dialog for the freed time slot
    const freedH = editStartH + (editStartM + newDuration >= 60 ? 1 : 0);
    setAddHour(String(freedH).padStart(2, '0'));
    setAddType(editType);
    setAddTask('');
    setTimeout(() => setAddOpen(true), 100);
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    persistBlocks(blocks.filter((b) => b.id !== blockId));
  };

  // Drag and drop
  const handleDragStart = (block: TimeBlockType) => {
    setDraggingBlock(block);
  };

  const handleDragEnd = () => {
    setDraggingBlock(null);
    setDragOverHour(null);
  };

  const handleDragOverHour = (e: React.DragEvent, hour: string) => {
    e.preventDefault();
    setDragOverHour(hour);
  };

  const handleDropOnHour = (targetHour: string) => {
    if (!draggingBlock) return;
    setDragOverHour(null);

    // Calculate duration from the block's time range
    const timeMatch = draggingBlock.time.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    let durationMin = 60; // default
    if (timeMatch) {
      const startMin = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      const endMin = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
      durationMin = endMin - startMin;
    }

    // Calculate new time string based on target hour
    const startH = parseInt(targetHour);
    const startM = 0;
    const endTotal = startH * 60 + startM + durationMin;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    const newTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}-${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // Update the block's time
    const updated = blocks.map((b) =>
      b.id === draggingBlock.id
        ? {
            ...b,
            time: newTime,
            modifications: [
              ...b.modifications,
              { time: new Date().toISOString(), original: b.time, new: newTime, reason: '拖拽调整' },
            ],
          }
        : b
    );
    persistBlocks(updated);
    setDraggingBlock(null);
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

  // Daily plan AI generate
  const handleGenerateDayPlan = async () => {
    if (!dayGoal.trim()) return;
    const settings = loadSettings();
    if (!settings.apiKey) {
      alert('请先在设置中配置 API');
      return;
    }
    setDayPlanLoading(true);
    const capturedDateStr = dateStr;
    const capturedWeekKey = weekKey;
    try {
      const newBlocks = await generateDayScheduleWithAI(dayGoal, dayLabel, dayBudget, settings);
      // Only save and update if user is still viewing the same day
      if (dateKeyRef.current === capturedDateStr) {
        const dayData = getDayBlocks(capturedWeekKey, capturedDateStr) || { blocks: [] };
        saveDayBlocks(capturedWeekKey, capturedDateStr, { ...dayData, blocks: newBlocks });
        setBlocks(newBlocks);
        setDayPlanExpanded(false);
      }
      setDayPlanLoading(false);
    } catch (err) {
      if (dateKeyRef.current === capturedDateStr) {
        alert(`生成失败：${err instanceof Error ? err.message : String(err)}`);
      }
      setDayPlanLoading(false);
    }
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

      {/* Today's Focus — from weekly goals */}
      {todayGoal && (
        <Card
          sx={{
            mb: 2,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #7C3AED08, #7C3AED15)',
            border: '1px solid #7C3AED20',
          }}
          elevation={0}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
              🎯 今日焦点
            </Typography>
            <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.6 }}>
              {todayGoal}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Schedule source indicator */}
      {scheduleSource === 'template' && blocks.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem', borderRadius: 2 }}>
          ⚠️ 当前计划由本地模板生成 — {scheduleError || '未配置 API'}。在右上角设置中配置 API 可获得 AI 个性化计划。
        </Alert>
      )}

      {/* Daily Planning */}
      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #F59E0B08, #F59E0B15)',
          border: '1px solid #F59E0B20',
        }}
        elevation={0}
      >
        <CardContent
          sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, cursor: 'pointer' }}
          onClick={() => setDayPlanExpanded(!dayPlanExpanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: '#F59E0B' }} />
              <Typography variant="body2" fontWeight={600} color="#B45309">
                每日安排
              </Typography>
              <Typography variant="caption" color="text.secondary">
                — AI 帮你规划今天的每小时任务
              </Typography>
            </Box>
            {dayPlanExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        </CardContent>
        <Collapse in={dayPlanExpanded}>
          <Box sx={{ px: 2, pb: 2, pt: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="今天想做什么？"
              value={dayGoal}
              onChange={(e) => setDayGoal(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="描述今天的目标，例如：完成项目报告、学习 React Hooks、整理文档..."
              onClick={(e) => e.stopPropagation()}
            />
            <Box onClick={(e) => e.stopPropagation()}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                时间预算（小时）
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="#7C3AED" fontWeight={600}>深度 {dayBudget.deep}h</Typography>
                  <Slider
                    value={dayBudget.deep}
                    onChange={(_, v) => setDayBudget((b) => ({ ...b, deep: v as number }))}
                    min={1} max={7} step={0.5}
                    size="small"
                    sx={{ color: '#7C3AED' }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="#F59E0B" fontWeight={600}>缓冲 {dayBudget.buffer}h</Typography>
                  <Slider
                    value={dayBudget.buffer}
                    onChange={(_, v) => setDayBudget((b) => ({ ...b, buffer: v as number }))}
                    min={0} max={4} step={0.5}
                    size="small"
                    sx={{ color: '#F59E0B' }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="#10B981" fontWeight={600}>休息 {dayBudget.break}h</Typography>
                  <Slider
                    value={dayBudget.break}
                    onChange={(_, v) => setDayBudget((b) => ({ ...b, break: v as number }))}
                    min={0.5} max={4} step={0.5}
                    size="small"
                    sx={{ color: '#10B981' }}
                  />
                </Box>
              </Box>
            </Box>
            <Button
              variant="contained"
              onClick={handleGenerateDayPlan}
              disabled={!dayGoal.trim() || dayPlanLoading}
              startIcon={dayPlanLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                '&:hover': { background: 'linear-gradient(135deg, #D97706, #B45309)' },
                alignSelf: 'flex-start',
              }}
            >
              {dayPlanLoading ? '生成中...' : 'AI 生成今日计划'}
            </Button>
          </Box>
        </Collapse>
      </Card>

      {/* Current hour indicator */}
      {isToday && HOURS.includes(currentHour) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7C3AED', animation: 'pulse-glow 2s infinite' }} />
          <Typography variant="caption" color="primary.main" fontWeight={600}>
            现在是 {currentHour}:00
          </Typography>
        </Box>
      )}

      {/* Time grid */}
      <Card sx={{ borderRadius: 3, overflow: 'hidden' }} elevation={0}>
        {HOURS.map((hour, hourIdx) => {
          const hourBlocks = getBlocksForHour(hour);
          const checkin = getCheckinForHour(hour);
          const isLast = hourIdx === HOURS.length - 1;

          const isCurrentHour = isToday && hour === currentHour;

          const isDragOver = dragOverHour === hour;

          return (
            <Box
              key={hour}
              ref={(el: HTMLDivElement | null) => { hourRefs.current[hour] = el; }}
              onDragOver={(e) => handleDragOverHour(e, hour)}
              onDragLeave={() => setDragOverHour(null)}
              onDrop={() => handleDropOnHour(hour)}
              sx={{
                ...(isCurrentHour && {
                  bgcolor: '#7C3AED06',
                  borderLeft: '3px solid #7C3AED',
                }),
                ...(isDragOver && {
                  bgcolor: '#7C3AED12',
                  outline: '2px dashed #7C3AED60',
                  outlineOffset: -2,
                }),
              }}
            >
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
                    bgcolor: isCurrentHour ? '#7C3AED10' : '#FAFAFA',
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={isCurrentHour ? 800 : 600}
                    color={isCurrentHour ? 'primary.main' : 'text.secondary'}
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
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
                    const isDragging = draggingBlock?.id === block.id;
                    return (
                      <Box
                        key={block.id}
                        draggable
                        onDragStart={() => handleDragStart(block)}
                        onDragEnd={handleDragEnd}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 0.75, sm: 1 },
                          px: { xs: 1, sm: 1.5 },
                          py: { xs: 0.75, sm: 1 },
                          borderRadius: 2,
                          bgcolor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          opacity: isDragging ? 0.4 : block.completed ? 0.6 : 1,
                          cursor: 'grab',
                          transition: 'all 0.15s',
                          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
                          '&:active': { cursor: 'grabbing' },
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
                        py: isCurrentHour ? 1.5 : 1,
                        borderRadius: 2,
                        border: isCurrentHour ? '2px dashed' : '1px dashed',
                        borderColor: isCurrentHour ? '#7C3AED50' : 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        bgcolor: isCurrentHour ? '#7C3AED08' : 'transparent',
                        '&:hover': { borderColor: 'primary.main', bgcolor: '#F8F7FF' },
                      }}
                      onClick={() => handleOpenAdd(hour)}
                    >
                      <AddIcon sx={{ fontSize: 16, color: isCurrentHour ? 'primary.main' : 'text.disabled', mr: 0.5 }} />
                      <Typography variant="caption" color={isCurrentHour ? 'primary.main' : 'text.disabled'} fontWeight={isCurrentHour ? 600 : 400}>
                        {isCurrentHour ? '当前小时暂无安排 — 点击添加' : '添加任务'}
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
          添加任务
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Time picker */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
              时间安排
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <select
                  value={addHour}
                  onChange={(e) => setAddHour(e.target.value)}
                  style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', width: 64, cursor: 'pointer' }}
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ color: '#71717A', fontWeight: 700 }}>:</span>
                <select
                  value={addStartM}
                  onChange={(e) => setAddStartM(Number(e.target.value))}
                  style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', width: 64, cursor: 'pointer' }}
                >
                  <option value={0}>00</option>
                  <option value={30}>30</option>
                </select>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>→</Typography>
              <Typography variant="body2" fontWeight={600}>
                {(() => { const e = Number(addHour) * 60 + addStartM + addDuration; return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`; })()}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <select
                value={addDuration}
                onChange={(e) => setAddDuration(Number(e.target.value))}
                style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                <option value={30}>30 分钟</option>
                <option value={60}>60 分钟</option>
              </select>
            </Box>
          </Box>
          <TextField
            label="任务描述"
            value={addTask}
            onChange={(e) => setAddTask(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            placeholder="这个时段要做什么？"
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
          {/* Time picker: scrollable selects */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
              时间安排
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <select
                  value={editStartH}
                  onChange={(e) => setEditStartH(Number(e.target.value))}
                  style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', width: 64, cursor: 'pointer' }}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 10).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span style={{ color: '#71717A', fontWeight: 700 }}>:</span>
                <select
                  value={editStartM}
                  onChange={(e) => setEditStartM(Number(e.target.value))}
                  style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', width: 64, cursor: 'pointer' }}
                >
                  <option value={0}>00</option>
                  <option value={30}>30</option>
                </select>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>→</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 44 }}>
                {(() => { const e = editStartH * 60 + editStartM + editDuration; return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`; })()}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <select
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value))}
                style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                <option value={30}>30 分钟</option>
                <option value={60}>60 分钟</option>
                <option value={90}>90 分钟</option>
              </select>
            </Box>
          </Box>
          <TextField label="任务描述" value={editTask} onChange={(e) => setEditTask(e.target.value)} size="small" fullWidth multiline rows={2} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>任务类型</Typography>
            <ToggleButtonGroup value={editType} exclusive onChange={(_, val) => val && setEditType(val)} size="small" fullWidth>
              <ToggleButton value="deep" sx={{ fontSize: '0.78rem' }}>深度工作</ToggleButton>
              <ToggleButton value="buffer" sx={{ fontSize: '0.78rem' }}>缓冲</ToggleButton>
              <ToggleButton value="break" sx={{ fontSize: '0.78rem' }}>休息</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {/* Split button */}
          {editingBlock && editDuration > 30 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleSplitBlock}
              sx={{ alignSelf: 'flex-start', borderRadius: 2, fontSize: '0.78rem', color: '#7C3AED', borderColor: '#7C3AED', '&:hover': { borderColor: '#6D28D9', bgcolor: '#F3F0FF' } }}
            >
              ✂️ 拆分为 30 分钟（剩余时间可另加任务）
            </Button>
          )}
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
          {checkinNote.trim() && (
            <Button
              size="small"
              variant="outlined"
              disabled={genCardLoading}
              onClick={async () => {
                const settings = loadSettings();
                if (!settings.apiKey) {
                  alert('请先在设置中配置 API');
                  return;
                }
                setGenCardLoading(true);
                try {
                  const card = await generateKnowledgeCardWithAI(checkinNote, settings);
                  const weekKey = getWeekKey(date);
                  addKnowledgeCard(weekKey, card);
                  alert('已生成知识卡片！可在知识卡片页查看');
                } catch (err) {
                  alert(`生成失败：${err instanceof Error ? err.message : String(err)}`);
                } finally {
                  setGenCardLoading(false);
                }
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              {genCardLoading ? '生成中...' : '🤖 AI 提取知识点'}
            </Button>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCheckinOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>取消</Button>
          <Button onClick={handleSaveCheckin} variant="contained" sx={{ borderRadius: 2 }}>
            {getCheckinForHour(checkinHour) ? '更新打卡' : '完成打卡'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Daily Summary */}
      <Card sx={{ mt: 2, borderRadius: 3 }} elevation={0}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            📝 今日一句话总结
          </Typography>
          <TextField
            value={dailySummary}
            onChange={(e) => setDailySummary(e.target.value)}
            onBlur={() => saveDailySummary(weekKey, dateStr, dailySummary)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="今天最大的收获是什么？一句话记录下来..."
          />
        </CardContent>
      </Card>
    </Box>
  );
}

export default DailySchedule;
