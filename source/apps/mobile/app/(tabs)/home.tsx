import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { api, type Task } from '@/api';
import { Badge, Button, Card, Checkbox, Empty, ErrorView, ListItem, Loading, ProgressBar, Row, Screen, Section, Text } from '@/components/ui';
import { relativeDay, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function Home() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { student, canShare } = useSession();
  const week = useAsync(() => api.getWeekSummary(), []);

  const toggle = async (task: Task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    week.setData((w) => (w ? { ...w, tasks: w.tasks.map((x) => (x.id === task.id ? { ...x, status: next } : x)) } : w));
    await api.updateTask(task.id, { status: next });
  };

  const w = week.data;
  const done = w?.tasks.filter((x) => x.status === 'done').length ?? 0;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="display">{t('home.greeting', { name: student?.preferred_name ?? '' })}</Text>
        <Text muted>{t('tagline')}</Text>
      </View>
      {!canShare ? (
        <Card onPress={() => router.push('/consent')} style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Text variant="heading">{t('consent.title')}</Text>
          <Text variant="small" muted>{t('consent.locked')}</Text>
        </Card>
      ) : null}

      <Text variant="title">{t('home.thisWeek')}</Text>
      {week.loading && !w ? <Loading /> : week.error ? <ErrorView error={week.error} onRetry={week.reload} /> : w ? (
        <>
          <Section title={t('home.tasks')} action={<Badge text={t('home.tasksDone', { done, total: w.tasks.length })} />}>
            <Card>
              {w.tasks.length === 0 ? <Empty text={t('common.none')} /> : null}
              {w.tasks.map((task) => (
                <Row key={task.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Checkbox checked={task.status === 'done'} onToggle={() => toggle(task)} label={task.title} />
                  </View>
                  <Text variant="small" muted>{relativeDay(task.due_at, lang)}</Text>
                </Row>
              ))}
            </Card>
          </Section>

          <Section title={t('home.deadlines')}>
            <Card>
              {w.deadlines.length === 0 ? <Empty text={t('home.noDeadlines')} icon="happy-outline" /> : null}
              {w.deadlines.map((d) => (
                <ListItem
                  key={d.id}
                  icon={d.kind === 'exam' ? 'school-outline' : d.kind === 'application' ? 'paper-plane-outline' : 'document-text-outline'}
                  iconColor={d.kind === 'exam' ? colors.danger : undefined}
                  title={d.title}
                  subtitle={t('common.due', { when: relativeDay(d.due_at, lang) })}
                  onPress={d.kind === 'application' ? () => router.push(`/opportunity/${d.id}`) : () => router.push('/classes')}
                />
              ))}
            </Card>
          </Section>

          <Section title={t('home.newOpps')} action={<Button title={t('common.seeAll')} variant="ghost" onPress={() => router.push('/opportunities')} style={{ paddingVertical: 6 }} />}>
            <Card>
              {w.new_opportunities.length === 0 ? <Empty text={t('common.none')} /> : null}
              {w.new_opportunities.map((o) => (
                <ListItem key={o.id} icon="rocket-outline" title={o.title} subtitle={o.organizer} onPress={() => router.push(`/opportunity/${o.id}`)} />
              ))}
            </Card>
          </Section>

          <Section title={t('home.goalProgress')} action={<Button title={t('common.seeAll')} variant="ghost" onPress={() => router.push('/goals')} style={{ paddingVertical: 6 }} />}>
            <Card>
              {w.goals.map((g) => (
                <View key={g.id} style={{ gap: 6, paddingVertical: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>{g.title}</Text>
                    <Text variant="small" muted>{g.progress}%</Text>
                  </Row>
                  <ProgressBar value={g.progress} color={g.progress >= 60 ? colors.success : undefined} />
                </View>
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
