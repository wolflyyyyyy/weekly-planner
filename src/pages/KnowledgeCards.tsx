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
import {
  KnowledgeCard as KnowledgeCardType,
} from '../types';
import {
  getAllKnowledgeCards,
  addKnowledgeCard,
  updateKnowledgeCard,
  getWeekKey,
} from '../data/storage';
import { generateKnowledgeCards } from '../data/aiSimulation';
import KnowledgeCardComp from '../components/KnowledgeCard';

function KnowledgeCards() {
  // State
  const [cards, setCards] = useState<KnowledgeCardType[]>([]);
  const [filteredCards, setFilteredCards] = useState<KnowledgeCardType[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // AI generation
  const [aiLoading, setAiLoading] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');

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

    setFilteredCards(result);
  }, [cards, searchQuery, filterTags]);

  // Mastery change
  const handleMasteryChange = (cardId: string, newMastery: number) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery: newMastery } : c))
    );
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      const cardWeekKey = getWeekKey(new Date(card.date));
      updateKnowledgeCard(cardWeekKey, cardId, { mastery: newMastery });
    }
  };

  const handleMarkMastered = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery: 3 } : c))
    );
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      const weekKey = getWeekKey(new Date(card.date));
      updateKnowledgeCard(weekKey, cardId, { mastery: 3 });
    }
  };

  // AI generate cards
  const handleAIGenerate = async () => {
    if (!noteInput.trim()) return;
    setAiLoading(true);
    try {
      const newCards = await generateKnowledgeCards(noteInput);
      const weekKey = getWeekKey(new Date());
      for (const card of newCards) {
        addKnowledgeCard(weekKey, card);
      }
      setCards((prev) => [...prev, ...newCards]);
      setGenDialogOpen(false);
      setNoteInput('');
    } finally {
      setAiLoading(false);
    }
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

  return (
    <Box>
      {/* Header */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        📚 知识卡片
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        AI 自动从工作笔记中提取知识，翻转卡片来复习
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
          variant="outlined"
          size="small"
          onClick={() => setShowFilters(!showFilters)}
          startIcon={<FilterListIcon />}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          筛选
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setGenDialogOpen(true)}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          AI生成
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
                ? '暂无知识卡片，点击"AI生成"来创建'
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
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* AI Generation Dialog */}
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
            输入今天的工作笔记或学习内容，AI 将自动提取关键知识点生成卡片。
          </Typography>
          <TextField
            label="笔记内容"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={5}
            placeholder="例如：今天学习了PRD文档编写，P0/P1/P2需求优先级如何区分..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            onClick={handleAIGenerate}
            variant="contained"
            disabled={!noteInput.trim() || aiLoading}
            startIcon={
              aiLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />
            }
          >
            {aiLoading ? 'AI 分析中...' : '生成卡片'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default KnowledgeCards;
