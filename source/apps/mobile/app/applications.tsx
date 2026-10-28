import { router } from 'expo-router';
import React from 'react';
import { api, type ApplicationStatus } from '@/api';
import { Badge, Card, Chip, ChipRow, Empty, Loading, ProgressBar, Row, Screen, Section, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';

const STATUSES: ApplicationStatus[] = ['saved', 'preparing', 'submitted', 'accepted', 'rejected'];
const TONE = { saved: 'muted', preparing: 'accent', submitted: 'primary', accepted: 'success', rejected: 'danger' } as const;

export default function Applications() {
  const { t, lang } = useI18n();
  const data = useAsync(async () => {
    const [apps, opps] = await Promise.all([api.listApplications(), api.listOpportunities({})]);
    return { apps, opps };
  }, []);

  const move = async (id: string, status: ApplicationStatus) => {
    data.setData((d) => (d ? { ...d, apps: d.apps.map((a) => (a.id === id ? { ...a, status } : a)) } : d));
    await api.updateApplication(id, { status });
  };

  if (data.loading && !data.data) return <Screen><Loading /></Screen>;
  const apps = data.data?.apps ?? [];
  if (!apps.length) return <Screen><Empty text={t('common.none')} /></Screen>;

  return (
    <Screen>
      {STATUSES.map((s) => {
        const group = apps.filter((a) => a.status === s);
        if (!group.length) return null;
        return (
          <Section key={s} title={`${t(`applications.${s}`)} (${group.length})`}>
            {group.map((a) => {
              const o = data.data?.opps.find((x) => x.id === a.opportunity_id);
              const done = a.checklist.filter((c) => c.done).length;
              return (
                <Card key={a.id} onPress={() => router.push(`/opportunity/${a.opportunity_id}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="heading" style={{ flex: 1 }}>{o?.title ?? a.opportunity_id}</Text>
                    <Badge text={t(`applications.${a.status}`)} tone={TONE[a.status]} />
                  </Row>
                  {o?.deadline ? <Text variant="small" muted>{t('opportunities.deadline', { date: formatDate(o.deadline, lang) })}</Text> : null}
                  {a.checklist.length ? <ProgressBar value={(done / a.checklist.length) * 100} /> : null}
                  {a.notes ? <Text variant="small" muted>{a.notes}</Text> : null}
                  <Text variant="label" muted>{t('applications.moveTo')}</Text>
                  <ChipRow>
                    {STATUSES.filter((x) => x !== a.status).map((x) => (
                      <Chip key={x} label={t(`applications.${x}`)} onPress={() => move(a.id, x)} />
                    ))}
                  </ChipRow>
                </Card>
              );
            })}
          </Section>
        );
      })}
    </Screen>
  );
}
