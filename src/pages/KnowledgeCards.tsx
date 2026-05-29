import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import {
  KnowledgeCard as KnowledgeCardType,
} from '../types';
import {
  getAllKnowledgeCards,
  addKnowledgeCard,
  updateKnowledgeCard,
  deleteKnowledgeCard,
  getWeekKey,
  loadSettings,
  getNextReviewDate,
  getDueCards,
} from '../data/storage';
import { generateKnowledgeCardWithAI } from '../data/aiService';
import KnowledgeCardComp from '../components/KnowledgeCard';

function KnowledgeCards() {
  // State
  const [cards, setCards] = useState<KnowledgeCardType[]>([]);
  const [filteredCards, setFilteredCards] = useState<KnowledgeCardType[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);

  // AI generation
  const [aiLoading, setAiLoading] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [questionInput, setQuestionInput] = useState('');

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCard, setEditCard] = useState<KnowledgeCardType | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editTags, setEditTags] = useState('');

  // Manual add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addQuestion, setAddQuestion] = useState('');
  const [addAnswer, setAddAnswer] = useState('');
  const [addTags, setAddTags] = useState('');

  // All tags
  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort();

  // Load cards
  useEffect(() => {
    const allCards = getAllKnowledgeCards();
    setCards(allCards);
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...cards];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.question.toLowerCase().includes(q) ||
          c.answer.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filterTags.length > 0) {
      result = result.filter((c) =>
        c.tags.some((t) => filterTags.includes(t))
      );
    }

    if (dueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((c) => !c.nextReviewDate || c.nextReviewDate <= today);
    }

    setFilteredCards(result);
  }, [cards, searchQuery, filterTags, dueOnly]);

  // Mastery change (with spaced repetition scheduling)
  const handleMasteryChange = (cardId: string, newMastery: number) => {
    const nextDate = getNextReviewDate(newMastery);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery: newMastery, nextReviewDate: nextDate } : c))
    );
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      const cardWeekKey = getWeekKey(new Date(card.date));
      updateKnowledgeCard(cardWeekKey, cardId, { mastery: newMastery, nextReviewDate: nextDate });
    }
  };

  const handleMarkMastered = (cardId: string) => {
    const nextDate = getNextReviewDate(3);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery: 3, nextReviewDate: nextDate, reviewCount: (c.reviewCount || 0) + 1 } : c))
    );
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      const weekKey = getWeekKey(new Date(card.date));
      updateKnowledgeCard(weekKey, cardId, { mastery: 3, nextReviewDate: nextDate, reviewCount: (card.reviewCount || 0) + 1 });
    }
  };

  // AI generate card from question
  const handleAIGenerate = async () => {
    if (!questionInput.trim()) return;
    setAiLoading(true);
    try {
      const settings = loadSettings();
      const newCard = await generateKnowledgeCardWithAI(questionInput, settings);
      newCard.nextReviewDate = getNextReviewDate(0);
      const weekKey = getWeekKey(new Date());
      addKnowledgeCard(weekKey, newCard);
      setCards((prev) => [...prev, newCard]);
      setGenDialogOpen(false);
      setQuestionInput('');
    } catch (err) {
      alert(`生成失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Delete card
  const handleDelete = (cardId: string) => {
    if (!confirm('确定删除这张卡片？')) return;
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      const weekKey = getWeekKey(new Date(card.date));
      deleteKnowledgeCard(weekKey, cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  };

  // Open edit dialog
  const handleEdit = (card: KnowledgeCardType) => {
    setEditCard(card);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
    setEditTags(card.tags.join(', '));
    setEditDialogOpen(true);
  };

  // Save edit
  const handleSaveEdit = () => {
    if (!editCard || !editQuestion.trim() || !editAnswer.trim()) return;
    const weekKey = getWeekKey(new Date(editCard.date));
    const tags = editTags
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    updateKnowledgeCard(weekKey, editCard.id, {
      question: editQuestion.trim(),
      answer: editAnswer.trim(),
      tags,
    });
    setCards((prev) =>
      prev.map((c) =>
        c.id === editCard.id
          ? { ...c, question: editQuestion.trim(), answer: editAnswer.trim(), tags }
          : c
      )
    );
    setEditDialogOpen(false);
    setEditCard(null);
  };

  // Manual add card
  const handleManualAdd = () => {
    if (!addQuestion.trim() || !addAnswer.trim()) return;
    const tags = addTags
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const newCard: KnowledgeCardType = {
      id: `kc-manual-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      question: addQuestion.trim(),
      answer: addAnswer.trim(),
      tags: tags.length > 0 ? tags : ['笔记'],
      mastery: 0,
      source: '手动添加',
      nextReviewDate: getNextReviewDate(0),
    };
    const weekKey = getWeekKey(new Date());
    addKnowledgeCard(weekKey, newCard);
    setCards((prev) => [...prev, newCard]);
    setAddDialogOpen(false);
    setAddQuestion('');
    setAddAnswer('');
    setAddTags('');
  };

  // Stats
  const totalCards = filteredCards.length;
  const masteredCards = filteredCards.filter((c) => c.mastery >= 3).length;
  const avgMastery =
    totalCards > 0
      ? Math.round(
          (filteredCards.reduce((sum, c) => sum + c.mastery, 0) / totalCards) * 10
        ) / 10
      : 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueCount = cards.filter((c) => !c.nextReviewDate || c.nextReviewDate <= todayStr).length;

  return (
    <Box>
      {/* Header */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        📚 知识卡片
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        向 AI 提问生成卡片，或手动添加，翻转卡片来复习
      </Typography>

      {/* Stats */}
      <Card sx={{ mb: 3 }}>
        <CardContent
          sx={{
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center',
            py: 2,
            '&:last-child': { pb: 2 },
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {totalCards}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              总卡片
            </Typography>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="success.main">
              {masteredCards}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              已掌握
            </Typography>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="secondary.main">
              {avgMastery}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              平均掌握度
            </Typography>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="warning.main">
              {dueCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              待复习
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Search & Actions */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="搜索卡片..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        <Button
          variant={dueOnly ? 'contained' : 'outlined'}
          size="small"
          color={dueOnly ? 'warning' : 'primary'}
          onClick={() => setDueOnly(!dueOnly)}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          待复习{dueCount > 0 ? `(${dueCount})` : ''}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowFilters(!showFilters)}
          startIcon={<FilterListIcon />}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', display: { xs: 'none', sm: 'flex' } }}
        >
          标签
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          添加
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setGenDialogOpen(true)}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          AI
        </Button>
      </Box>

      {/* Filter panel */}
      {showFilters && allTags.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              按标签筛选:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {allTags.map((tag) => {
                const selected = filterTags.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    onClick={() => {
                      setFilterTags((prev) =>
                        selected
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
              {filterTags.length > 0 && (
                <Chip
                  label="清除"
                  size="small"
                  onDelete={() => setFilterTags([])}
                  color="error"
                  variant="outlined"
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {cards.length === 0
                ? '暂无知识卡片，点击"AI"提问或"添加"手动创建'
                : '没有匹配的卡片'}
            </Typography>
            {cards.length === 0 && (
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setGenDialogOpen(true)}
              >
                AI生成卡片
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredCards.map((card) => (
            <Grid item xs={12} sm={6} key={card.id}>
              <KnowledgeCardComp
                card={card}
                onMasteryChange={handleMasteryChange}
                onMarkMastered={handleMarkMastered}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* AI Generation Dialog — ask a question */}
      <Dialog
        open={genDialogOpen}
        onClose={() => setGenDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          <AutoAwesomeIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          AI 生成知识卡片
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            提出你的问题，AI 会生成一张正面是问题、背面是简洁答案的复习卡片。
          </Typography>
          <TextField
            label="你的问题"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
            placeholder="例如：什么是 SOLID 原则？React 的 useEffect 依赖数组怎么用？"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAIGenerate();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            onClick={handleAIGenerate}
            variant="contained"
            disabled={!questionInput.trim() || aiLoading}
            startIcon={
              aiLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />
            }
          >
            {aiLoading ? 'AI 生成中...' : '生成卡片'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>编辑卡片</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="问题"
            value={editQuestion}
            onChange={(e) => setEditQuestion(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="答案"
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={4}
          />
          <TextField
            label="标签（逗号分隔）"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            size="small"
            fullWidth
            placeholder="标签1, 标签2"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={!editQuestion.trim() || !editAnswer.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Add Card Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>手动添加卡片</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="问题"
            value={addQuestion}
            onChange={(e) => setAddQuestion(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="正面的问题"
          />
          <TextField
            label="答案"
            value={addAnswer}
            onChange={(e) => setAddAnswer(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={4}
            placeholder="背面的答案（简洁、结构化）"
          />
          <TextField
            label="标签（逗号分隔）"
            value={addTags}
            onChange={(e) => setAddTags(e.target.value)}
            size="small"
            fullWidth
            placeholder="标签1, 标签2"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            onClick={handleManualAdd}
            variant="contained"
            disabled={!addQuestion.trim() || !addAnswer.trim()}
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default KnowledgeCards;
