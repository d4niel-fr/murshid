import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api, type Task } from '@/api';
import { Badge, Button, Card, Checkbox, Chip, Empty, Loading, Row, Screen, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { addDays, sameDay, startOfWeek } from '@/lib/dates';
import { useAsync } from '@/lib/useAsync';
import { useTheme } from '@/theme';

export default function Planner() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(new Date());
  const from = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const to = addDays(from, 7);
  const data = useAsync(async () => {
    const [tasks, events] = await Promise.all([api.listTasks(from.toISOString(), to.toISOString()), api.listEvents(from.toISOString(), to.toISOString())]);
    return { tasks, events };
  }, [from.getTime()]);

  const toggle = async (task: Task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    data.setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.id === task.id ? { ...x, status: next } : x)) } : d));
    await api.updateTask(task.id, { status: next });
  };

  const dayTasks = (data.data?.tasks ?? []).filter((x) => x.due_at && sameDay(new Date(x.due_at), selected));
  const dayEvents = (data.data?.events ?? []).filter((e) => sameDay(new Date(e.start_at), selected));
  const countFor = (d: Date) => (data.data?.tasks ?? []).filter((x) => x.due_at && sameDay(new Date(x.due_at), d)).length;
  const time = (iso: string) => formatDate(iso, lang, { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen title={t('planner.title')}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="‹" variant="secondary" onPress={() => setWeekOffset((w) => w - 1)} />
        <Text variant="heading">
          {formatDate(from.toISOString(), lang)} – {formatDate(addDays(from, 6).toISOString(), lang)}
        </Text>
        <Button title="›" variant="secondary" onPress={() => setWeekOffset((w) => w + 1)} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => {
          const active = sameDay(d, selected);
          const n = countFor(d);
          return (
            <View key={d.toISOString()} style={{ alignItems: 'center', gap: 4 }}>
              <Chip label={`${formatDate(d.toISOString(), lang, { weekday: 'short' })} ${d.getDate()}`} selected={active} onPress={() => setSelected(d)} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: n ? colors.accent : 'transparent' }} />
            </View>
          );
        })}
      </ScrollView>
      <Chip label={t('planner.today')} onPress={() => { setWeekOffset(0); setSelected(new Date()); }} icon="today-outline" />

      {data.loading && !data.data ? <Loading /> : (
        <>
          {dayEvents.length ? (
            <Card>
              <Text variant="label" muted>{t('planner.events')}</Text>
              {dayEvents.map((e) => (
                <Row key={e.id} style={{ justifyContent: 'space-between' }}>
                  <Text style={{ flex: 1 }}>{e.title}</Text>
                  <Text variant="small" muted>{time(e.start_at)}–{time(e.end_at)}</Text>
                </Row>
              ))}
            </Card>
          ) : null}
          <Card>
            {dayTasks.length === 0 ? <Empty text={t('planner.empty')} icon="sunny-outline" /> : null}
            {dayTasks.map((task) => (
              <Row key={task.id} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Checkbox checked={task.status === 'done'} onToggle={() => toggle(task)} label={task.title} />
                </View>
                <Row gap={6}>
                  {task.est_minutes ? <Text variant="small" muted>{task.est_minutes}m</Text> : null}
                  <Badge text={task.kind} tone={task.kind === 'assignment' ? 'danger' : task.kind === 'application' ? 'accent' : 'primary'} />
                </Row>
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
