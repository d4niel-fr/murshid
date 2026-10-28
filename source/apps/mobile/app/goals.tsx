import React, { useState } from 'react';
import { View } from 'react-native';
import { api, type Goal, type GoalCategory, type Milestone } from '@/api';
import { Badge, Button, Card, Checkbox, Chip, ChipRow, Input, Loading, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useTheme } from '@/theme';

const CATS: GoalCategory[] = ['academic', 'university', 'career', 'sport', 'skill', 'personal'];

export default function Goals() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const data = useAsync(async () => {
    const [goals, milestones] = await Promise.all([api.listGoals(), api.listMilestones()]);
    return { goals, milestones };
  }, []);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<GoalCategory>('academic');

  const toggle = async (m: Milestone) => {
    await api.toggleMilestone(m.id, !m.done);
    data.reload();
  };
  const add = async () => {
    if (!title.trim()) return;
    await api.createGoal({ title: title.trim(), category: cat, parent_goal_id: null, target_date: null });
    setTitle('');
    data.reload();
  };

  const renderGoal = (g: Goal, depth: number): React.ReactNode => {
    const kids = (data.data?.goals ?? []).filter((x) => x.parent_goal_id === g.id);
    const ms = (data.data?.milestones ?? []).filter((m) => m.goal_id === g.id);
    return (
      <View key={g.id} style={{ gap: 8, paddingStart: depth ? 14 : 0, borderStartWidth: depth ? 2 : 0, borderColor: colors.primarySoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant={depth ? 'body' : 'heading'} style={{ flex: 1, fontWeight: '700' }}>{g.title}</Text>
          <Badge text={g.category} tone={depth ? 'muted' : 'primary'} />
        </Row>
        <Row>
          <View style={{ flex: 1 }}><ProgressBar value={g.progress} /></View>
          <Text variant="small" muted>{g.progress}%</Text>
        </Row>
        {g.target_date ? <Text variant="small" muted>→ {formatDate(g.target_date, lang, { month: 'short', year: 'numeric' })}</Text> : null}
        {ms.map((m) => (
          <Checkbox key={m.id} checked={m.done} onToggle={() => toggle(m)} label={`${m.title}${m.due_date ? ' · ' + formatDate(m.due_date, lang) : ''}`} />
        ))}
        {kids.map((k) => renderGoal(k, depth + 1))}
      </View>
    );
  };

  return (
    <Screen>
      {data.loading && !data.data ? <Loading /> : null}
      {(data.data?.goals ?? []).filter((g) => !g.parent_goal_id).map((g) => <Card key={g.id}>{renderGoal(g, 0)}</Card>)}
      <Card>
        <Text variant="heading">{t('goals.add')}</Text>
        <Input placeholder={t('goals.newGoal')} value={title} onChangeText={setTitle} />
        <ChipRow>{CATS.map((c) => <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} />)}</ChipRow>
        <Button title={t('goals.add')} icon="add" onPress={add} disabled={!title.trim()} />
      </Card>
    </Screen>
  );
}
