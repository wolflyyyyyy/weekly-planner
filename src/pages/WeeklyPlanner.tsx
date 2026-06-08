import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Slider,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TodayIcon from '@mui/icons-material/Today';
import {
  startOfWeek,
  addWeeks,
  addDays,
  format,
  getISOWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Goals,
  TimeBlock as TimeBlockType,
  TimeBudget,
  DEFAULT_BUDGET,
  DAY_NAMES,
  DAY_LABELS,
  DAY_SHORT,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_COLORS,
} from '../types';
import {
  getWeekKey,
  getOrCreateWeekData,
  saveGoals,
  saveDayBlocks,
  saveScheduleSource,
  loadSettings,
} from '../data/storage';
import { generateScheduleWithAI, type ScheduleResult } from '../data/aiService';
import TimeBlockComp from '../components/TimeBlock';

/** Calculate week date range: Monday to Friday */
function getWeekRange(weekOffset: number): { monday: Date; friday: Date; days: Date[] } {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const weekMonday = addWeeks(monday, weekOffset);
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    days.push(addDays(weekMonday, i));
  }
  return {
    monday: weekMonday,
    friday: addDays(weekMonday, 4),
    days,
  };
}

function WeeklyPlanner() {
  const navigate = useNavigate();

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);
  const { monday, friday, days } = getWeekRange(weekOffset);
  const weekKey = getWeekKey(monday);

  // Goals state
  const [goals, setGoals] = useState<Goals>({});
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  // Time budget
  const [budget, setBudget] = useState<TimeBudget>(DEFAULT_BUDGET);

  // Generated schedule
  const [schedule, setSchedule] = useState<Record<string, TimeBlockType[]>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const [genSource, setGenSource] = useState<'ai' | 'template' | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<{
    day: string;
    block: TimeBlockType;
  } | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState<TimeBlockType['type']>('deep');
  const [editReason, setEditReason] = useState('');

  // Load data when week changes
  useEffect(() => {
    const weekData = getOrCreateWeekData(weekKey);
    setGoals({ ...weekData.goals });
    setGoalsLoaded(true);

    // Check if schedule exists for this week
    const dayKeys = Object.keys(weekData.days);
    if (dayKeys.length > 0) {
      const daySchedule: Record<string, TimeBlockType[]> = {};
      for (const dayName of DAY_NAMES) {
        const dayIdx = DAY_NAMES.indexOf(dayName);
        const dateStr = format(days[dayIdx], 'yyyy-MM-dd');
        daySchedule[dayName] = weekData.days[dateStr]?.blocks || [];
      }
      setSchedule(daySchedule);
      setScheduleGenerated(dayKeys.length > 0);
    } else {
      setSchedule({});
      setScheduleGenerated(false);
    }
  }, [weekKey]);

  // Handle goal change
  const handleGoalChange = (day: string, value: string) => {
    setGoals((prev) => ({ ...prev, [day]: value }));
  };

  // Save goals
  const handleSaveGoals = () => {
    saveGoals(weekKey, goals);
  };

  // AI generate schedule
  const handleAIGenerate = async () => {
    setAiLoading(true);
    setGenError(null);
    try {
      // Save current goals first
      saveGoals(weekKey, goals);

      const settings = loadSettings();
      const result: ScheduleResult = await generateScheduleWithAI(goals, budget, settings);

      // Only save days that were generated (non-empty), leave others untouched
      for (let i = 0; i < DAY_NAMES.length; i++) {
        const dayName = DAY_NAMES[i];
        const blocks = result.schedule[dayName];
        if (blocks && blocks.length > 0) {
          const dateStr = format(days[i], 'yyyy-MM-dd');
          saveDayBlocks(weekKey, dateStr, { blocks });
        }
      }

      // Merge with existing schedule — don't clear days that weren't regenerated
      setSchedule(prev => ({ ...prev, ...result.schedule }));
      setScheduleGenerated(true);
      setGenSource(result.source);
      if (result.error) setGenError(result.error);
      saveScheduleSource(weekKey, result.source, result.error);
    } finally {
      setAiLoading(false);
    }
  };

  // Edit block
  const handleEditBlock = (day: string, block: TimeBlockType) => {
    setEditingBlock({ day, block });
    setEditTask(block.task);
    setEditTime(block.time);
    setEditType(block.type);
    setEditReason('');
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingBlock) return;

    const { day, block } = editingBlock;
    const dayIdx = (DAY_NAMES as readonly string[]).indexOf(day);
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd');

    const updatedBlock: TimeBlockType = {
      ...block,
      task: editTask,
      time: editTime,
      type: editType,
      modifications: [
        ...block.modifications,
        {
          time: new Date().toISOString(),
          original: block.task,
          new: editTask,
          reason: editReason || '手动调整',
        },
      ],
    };

    const updatedBlocks = schedule[day].map((b) =>
      b.id === block.id ? updatedBlock : b
    );

    const newSchedule = { ...schedule, [day]: updatedBlocks };
    setSchedule(newSchedule);
    saveDayBlocks(weekKey, dateStr, { blocks: updatedBlocks });
    setEditOpen(false);
  };

  // Toggle complete
  const handleToggleComplete = (day: string, blockId: string) => {
    const dayIdx = (DAY_NAMES as readonly string[]).indexOf(day);
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd');

    const updatedBlocks = schedule[day].map((b) =>
      b.id === blockId ? { ...b, completed: !b.completed } : b
    );

    const newSchedule = { ...schedule, [day]: updatedBlocks };
    setSchedule(newSchedule);
    saveDayBlocks(weekKey, dateStr, { blocks: updatedBlocks });
  };

  // Budget change handler
  const handleBudgetChange = (key: keyof TimeBudget, value: number) => {
    setBudget((prev) => {
      const next = { ...prev, [key]: value };
      const total = next.deep + next.buffer + next.break;
      if (total === 0) return prev; // Guard against division by zero
      if (total !== 9) {
        const ratio = 9 / total;
        next.deep = Math.round(next.deep * ratio);
        next.buffer = Math.round(next.buffer * ratio);
        next.break = 9 - next.deep - next.buffer;
      }
      return next;
    });
  };

  return (
    <Box>
      {/* Week Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <IconButton onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeftIcon />
            </IconButton>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {format(monday, 'M月d日', { locale: zhCN })} -{' '}
                {format(friday, 'M月d日', { locale: zhCN })}
              </Typography>
              <Chip
                label={`第${getISOWeek(monday)}周`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mt: 0.5 }}
              />
            </Box>

            <IconButton onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Goals Input */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        🎯 本周目标
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {days.map((day, idx) => (
            <TextField
              key={DAY_NAMES[idx]}
              label={`${DAY_LABELS[DAY_NAMES[idx]]} (${format(day, 'M/d')})`}
              value={goals[DAY_NAMES[idx]] || ''}
              onChange={(e) => handleGoalChange(DAY_NAMES[idx], e.target.value)}
              onBlur={handleSaveGoals}
              size="small"
              fullWidth
              placeholder={`输入${DAY_LABELS[DAY_NAMES[idx]]}目标...`}
              InputProps={{
                sx: { fontSize: '0.9rem' },
              }}
            />
          ))}
        </CardContent>
      </Card>

      {/* Time Budget */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        ⏱️ 时间预算（每日 9 小时）
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {(['deep', 'buffer', 'break'] as const).map((type) => (
            <Box key={type} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: BLOCK_TYPE_COLORS[type],
                    }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {BLOCK_TYPE_LABELS[type]}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  {budget[type]}h
                </Typography>
              </Box>
              <Slider
                value={budget[type]}
                onChange={(_, val) =>
                  handleBudgetChange(type, val as number)
                }
                min={0}
                max={9}
                step={1}
                marks={[
                  { value: 0, label: '0h' },
                  { value: 3, label: '3h' },
                  { value: 6, label: '6h' },
                  { value: 9, label: '9h' },
                ]}
                sx={{
                  color: BLOCK_TYPE_COLORS[type],
                  '& .MuiSlider-thumb': { width: 16, height: 16 },
                }}
              />
            </Box>
          ))}
          <Alert severity="info" sx={{ mt: 1, fontSize: '0.8rem' }}>
            总计：{budget.deep + budget.buffer + budget.break}h（10:00-19:00）
          </Alert>
        </CardContent>
      </Card>

      {/* AI Generate Button */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleAIGenerate}
          disabled={aiLoading}
          startIcon={
            aiLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <AutoAwesomeIcon />
            )
          }
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '1rem',
          }}
        >
          {aiLoading ? 'AI 正在生成计划...' : 'AI生成计划'}
        </Button>
      </Box>

      {/* Generated Schedule */}
      {scheduleGenerated && (
        <>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            📋 生成的周计划
          </Typography>
          {genSource === 'ai' && (
            <Alert severity="success" sx={{ mb: 2, fontSize: '0.85rem' }}>
              ✅ AI 生成 — 已调用 API 逐天生成个性化计划
            </Alert>
          )}
          {genSource === 'template' && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: '0.85rem' }}>
              ⚠️ 本地模板生成 — {genError || '未配置 API'}。请在右上角设置中配置 API 以获得个性化计划。
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {DAY_NAMES.map((dayName, idx) => {
              const blocks = schedule[dayName] || [];
              const completedCount = blocks.filter((b) => b.completed).length;
              const totalCount = blocks.length;

              return (
                <Card key={dayName} sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      bgcolor: '#F8FAFC',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={DAY_SHORT[dayName]}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 700, minWidth: 32 }}
                      />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {DAY_LABELS[dayName]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(days[idx], 'M/d')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {completedCount}/{totalCount}
                      </Typography>
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => {
                            const dateStr = format(days[idx], 'yyyy-MM-dd');
                            navigate(`/day/${dateStr}`);
                          }}
                        >
                          <TodayIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {blocks.slice(0, 5).map((block) => (
                      <TimeBlockComp
                        key={block.id}
                        block={block}
                        compact
                        onToggleComplete={() =>
                          handleToggleComplete(dayName, block.id)
                        }
                        onEdit={() => handleEditBlock(dayName, block)}
                      />
                    ))}
                    {blocks.length > 5 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        textAlign="center"
                      >
                        ... 还有 {blocks.length - 5} 个时间段
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </>
      )}

      {/* Edit Block Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>编辑时间段</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="时间范围"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            size="small"
            fullWidth
            placeholder="10:00-10:50"
          />
          <TextField
            label="任务描述"
            value={editTask}
            onChange={(e) => setEditTask(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              任务类型
            </Typography>
            <ToggleButtonGroup
              value={editType}
              exclusive
              onChange={(_, val) => val && setEditType(val)}
              size="small"
              fullWidth
            >
              <ToggleButton value="deep" sx={{ fontWeight: 600 }}>
                🔵 深度工作
              </ToggleButton>
              <ToggleButton value="buffer" sx={{ fontWeight: 600 }}>
                🟡 缓冲
              </ToggleButton>
              <ToggleButton value="break" sx={{ fontWeight: 600 }}>
                🟢 休息
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <TextField
            label="调整原因"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            size="small"
            fullWidth
            placeholder="为什么调整这个时间段？"
            helperText="记录变更原因，便于回顾分析"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} color="inherit">
            取消
          </Button>
          <Button onClick={handleSaveEdit} variant="contained">
            保存调整
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WeeklyPlanner;
