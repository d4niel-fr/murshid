import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { api, type Application } from '@/api';
import { Badge, Button, Card, Checkbox, Empty, Loading, ProgressBar, Row, Screen, Section, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { emirateLabel, oppTypeLabel } from '@/lib/labels';

export default function OpportunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const data = useAsync(async () => {
    const [opp, apps] = await Promise.all([api.getOpportunity(String(id)), api.listApplications()]);
    return { opp, app: apps.find((a) => a.opportunity_id === id) ?? null };
  }, [id]);

  if (data.loading && !data.data) return <Screen><Loading /></Screen>;
  const opp = data.data?.opp;
  if (!opp) return <Screen><Empty text={t('common.none')} /></Screen>;
  const app = data.data?.app ?? null;

  const setApp = (a: Application) => data.setData((d) => (d ? { ...d, app: a } : d));
  const save = async () => setApp(await api.saveOpportunity(opp.id));
  const toggle = async (i: number) => {
    if (!app) return;
    const checklist = app.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c));
    const status = app.status === 'saved' && checklist.some((c) => c.done) ? 'preparing' : app.status;
    setApp({ ...app, checklist, status });
    await api.updateApplication(app.id, { checklist, status });
  };
  const doneCount = app?.checklist.filter((c) => c.done).length ?? 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: opp.organizer }} />
      <Row>
        <Badge text={oppTypeLabel(opp.type)} />
        {opp.status === 'closed' ? <Badge text={t('opportunities.closed')} tone="muted" /> : null}
        {app ? <Badge text={t(`applications.${app.status}`)} tone="accent" /> : null}
      </Row>
      <Text variant="title">{opp.title}</Text>
      <Text muted>{opp.organizer} · {opp.emirate ? emirateLabel(opp.emirate) : opp.country}</Text>
      <Card>
        <Text>{opp.deadline ? t('opportunities.deadline', { date: formatDate(opp.deadline, lang, { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('opportunities.noDeadline')}</Text>
        {opp.min_grade !== null && opp.max_grade !== null ? <Text variant="small" muted>{t('opportunities.grades', { min: opp.min_grade, max: opp.max_grade })}</Text> : null}
        <Text variant="small" muted>{opp.cost_aed === 0 ? t('common.free') : t('opportunities.cost', { aed: opp.cost_aed })}</Text>
      </Card>
      <Section title={t('opportunities.eligibility')}>
        <Text>{opp.eligibility_text}</Text>
      </Section>
      <Section title={t('opportunities.checklist')} action={app ? <Text variant="small" muted>{doneCount}/{app.checklist.length}</Text> : null}>
        {app ? (
          <Card>
            <ProgressBar value={app.checklist.length ? (doneCount / app.checklist.length) * 100 : 0} />
            {app.checklist.map((c, i) => (
              <Checkbox key={c.item} checked={c.done} label={c.item} onToggle={() => toggle(i)} />
            ))}
          </Card>
        ) : (
          <Button title={t('opportunities.save')} icon="bookmark-outline" onPress={save} disabled={opp.status === 'closed'} />
        )}
      </Section>
      <Button title={t('opportunities.openSite')} variant="ghost" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(opp.url)} />
    </Screen>
  );
}
