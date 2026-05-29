import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Grid,
  Alert,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import QuizIcon from '@mui/icons-material/Quiz';
import {
  startOfWeek,
  addDays,
  format,
  getISOWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  TimeBlock,
  KnowledgeCard,
  DAY_NAMES,
  DAY_LABELS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_COLORS,
} from '../types';
import {
  getWeekKey,
  getOrCreateWeekData,
  getAllKnowledgeCards,
  updateKnowledgeCard,
} from '../data/storage';

function WeeklyReview() {
  // Week data
  const weekKey = getWeekKey(new Date());
  const weekData = getOrCreateWeekData(weekKey);
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  // Computed stats
  const allBlocks: Array<{ day: string; block: TimeBlock }> = [];
  for (let i = 0; i < 5; i++) {
    const dateStr = format(days[i], 'yyyy-MM-dd');
    const dayData = weekData.days[dateStr];
    if (dayData) {
      for (const block of dayData.blocks) {
        allBlocks.push({ day: DAY_NAMES[i], block });
      }
    }
  }

  // Per-day completion
  const dayStats = DAY_NAMES.map((dayName, idx) => {
    const dateStr = format(days[idx], 'yyyy-MM-dd');
    const dayData = weekData.days[dateStr];
    const blocks = dayData?.blocks || [];
    const total = blocks.length;
    const completed = blocks.filter((b) => b.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      name: DAY_LABELS[dayName],
      completed,
      total,
      pct,
      date: dateStr,
    };
  });

  // Time allocation breakdown
  let deepMin = 0;
  let bufferMin = 0;
  let breakMin = 0;
  for (const { block } of allBlocks) {
    const [start, end] = block.time.split('-');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (block.type === 'deep') deepMin += minutes;
    else if (block.type === 'buffer') bufferMin += minutes;
    else breakMin += minutes;
  }
  const totalMin = deepMin + bufferMin + breakMin;

  const timeAllocationData = [
    { name: '深度工作', value: deepMin, color: BLOCK_TYPE_COLORS.deep },
    { name: '缓冲', value: bufferMin, color: BLOCK_TYPE_COLORS.buffer },
    { name: '休息', value: breakMin, color: BLOCK_TYPE_COLORS.break },
  ].filter((d) => d.value > 0);

  const timeAllocationPct = timeAllocationData.map((d) => ({
    ...d,
    pct: totalMin > 0 ? Math.round((d.value / totalMin) * 100) : 0,
  }));

  // Plan deviation analysis
  const totalModifications = allBlocks.reduce(
    (sum, { block }) => sum + block.modifications.length,
    0
  );
  const blocksWithMods = allBlocks.filter(
    ({ block }) => block.modifications.length > 0
  ).length;

  // Deviation by day
  const deviationByDay = DAY_NAMES.map((dayName, idx) => {
    const dateStr = format(days[idx], 'yyyy-MM-dd');
    const dayData = weekData.days[dateStr];
    const blocks = dayData?.blocks || [];
    const mods = blocks.reduce((sum, b) => sum + b.modifications.length, 0);
    return { name: DAY_LABELS[dayName], 调整次数: mods };
  });

  // Overall completion
  const totalBlocks = allBlocks.length;
  const completedBlocks = allBlocks.filter(({ block }) => block.completed).length;
  const overallPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  // Quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizCards, setQuizCards] = useState<KnowledgeCard[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<
    Array<{ card: KnowledgeCard; rating: number }>
  >([]);
  const [quizDone, setQuizDone] = useState(false);

  // Start quiz
  const handleStartQuiz = () => {
    const allCards = getAllKnowledgeCards();
    if (allCards.length === 0) {
      alert('暂无知识卡片可测试');
      return;
    }
    // Shuffle and pick up to 5
    const shuffled = [...allCards].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuizCards(shuffled);
    setCurrentQuizIdx(0);
    setUserAnswer('');
    setQuizRevealed(false);
    setSelfRating(null);
    setQuizResults([]);
    setQuizDone(false);
    setQuizOpen(true);
  };

  const handleRevealAnswer = () => {
    setQuizRevealed(true);
  };

  const handleNextQuiz = () => {
    if (selfRating === null) return;

    const card = quizCards[currentQuizIdx];
    setQuizResults((prev) => [...prev, { card, rating: selfRating }]);

    // Update mastery in storage
    const weekKey = getWeekKey(new Date(card.date));
    const newMastery = Math.min(3, card.mastery + selfRating);
    updateKnowledgeCard(weekKey, card.id, { mastery: newMastery });

    if (currentQuizIdx < quizCards.length - 1) {
      setCurrentQuizIdx((prev) => prev + 1);
      setUserAnswer('');
      setQuizRevealed(false);
      setSelfRating(null);
    } else {
      setQuizDone(true);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        📊 周回顾
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        周六回顾 — 第{getISOWeek(monday)}周 ({format(monday, 'M/d')}-{format(addDays(monday, 4), 'M/d')})
      </Typography>

      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            本周概览
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {overallPct}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  整体完成率
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {completedBlocks}/{totalBlocks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  完成任务
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color="secondary.main">
                  {totalModifications}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  计划调整
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {getAllKnowledgeCards().length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  知识卡片
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Daily Completion */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        📅 每日完成率
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {dayStats.map((day) => (
            <Box key={day.name} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {day.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {day.completed}/{day.total} ({day.pct}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={day.pct}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: '#F3F4F6',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 5,
                    bgcolor:
                      day.pct >= 80
                        ? 'success.main'
                        : day.pct >= 50
                        ? 'secondary.main'
                        : 'error.main',
                  },
                }}
              />
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Time Allocation */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        ⏱️ 时间分配
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {timeAllocationPct.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timeAllocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {timeAllocationData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) =>
                        `${Math.round(value / 60)}h${value % 60}m`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ flex: 1 }}>
                {timeAllocationPct.map((item) => (
                  <Box
                    key={item.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: item.color,
                      }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 70 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {Math.round(item.value / 60)}h{item.value % 60}m ({item.pct}%)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
              暂无本周时间数据
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Plan Deviation */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        🔄 计划偏差分析
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {allBlocks.length > 0 ? (
            <>
              <Box sx={{ height: 200, mb: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deviationByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar
                      dataKey="调整次数"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                      name="调整次数"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                本周共 {totalModifications} 次计划调整，涉及 {blocksWithMods} 个时间段。
                {totalModifications > 5
                  ? ' 调整较多，建议下周优化目标设定。'
                  : ' 计划执行良好！'}
              </Alert>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
              暂无本周计划数据
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Quiz */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        🧠 知识测验
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <QuizIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>
            测试你对本周知识的掌握程度
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            从知识卡片中随机抽取题目，自评掌握程度
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleStartQuiz}
          >
            开始测验
          </Button>
        </CardContent>
      </Card>

      {/* Quiz Dialog */}
      <Dialog
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={false}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {quizDone ? '测验完成！' : `知识测验 (${currentQuizIdx + 1}/${quizCards.length})`}
        </DialogTitle>
        <DialogContent
          sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {!quizDone && quizCards.length > 0 && (
            <>
              {/* Question */}
              <Card
                sx={{
                  bgcolor: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  p: 2,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  ❓ {quizCards[currentQuizIdx].question}
                </Typography>
              </Card>

              {/* Tags */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {quizCards[currentQuizIdx].tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Box>

              {/* User answer input */}
              <TextField
                label="你的回答"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
                placeholder="输入你的答案..."
                disabled={quizRevealed}
              />

              {!quizRevealed ? (
                <Button variant="outlined" onClick={handleRevealAnswer} fullWidth>
                  查看正确答案
                </Button>
              ) : (
                <>
                  {/* Revealed answer */}
                  <Card
                    sx={{
                      bgcolor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      p: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="success.dark"
                      fontWeight={600}
                    >
                      💡 正确答案
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.5, whiteSpace: 'pre-line' }}
                    >
                      {quizCards[currentQuizIdx].answer}
                    </Typography>
                  </Card>

                  {/* Self rating */}
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                      自我评估掌握程度 (0-3):
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating
                        value={selfRating}
                        max={3}
                        size="large"
                        onChange={(_, val) => setSelfRating(val)}
                        sx={{
                          '& .MuiRating-iconFilled': { color: '#7C3AED' },
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {selfRating !== null
                          ? ['完全不会', '有点印象', '基本掌握', '完全掌握'][
                              selfRating
                            ]
                          : '请评分'}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleNextQuiz}
                    disabled={selfRating === null}
                    fullWidth
                  >
                    {currentQuizIdx < quizCards.length - 1 ? '下一题' : '完成测验'}
                  </Button>
                </>
              )}
            </>
          )}

          {quizDone && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                测验完成！你回答了 {quizResults.length} 道题目。
              </Alert>

              {quizResults.map((result, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.5,
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {idx + 1}. {result.card.question}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      自评:
                    </Typography>
                    <Rating
                      value={result.rating}
                      max={3}
                      size="small"
                      readOnly
                      sx={{
                        '& .MuiRating-iconFilled': { color: '#7C3AED' },
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setQuizOpen(false)} color="inherit">
            {quizDone ? '关闭' : '退出测验'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WeeklyReview;
