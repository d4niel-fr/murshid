import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api, type OpportunityType } from '@/api';
import { OPP_TYPES, oppTypeLabel } from '@/lib/labels';
import { Badge, Button, Card, Chip, Empty, ErrorView, Input, Loading, Row, Screen, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';



export default function Opportunities() {
  const { t, lang } = useI18n();
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const list = useAsync(() => api.listOpportunities({ type, query, freeOnly, eligibleOnly }), [type, query, freeOnly, eligibleOnly]);
  const apps = useAsync(() => api.listApplications(), []);
  const savedIds = new Set((apps.data ?? []).map((a) => a.opportunity_id));

  const save = async (id: string) => {
    await api.saveOpportunity(id);
    apps.reload();
  };

  return (
    <Screen title={t('opportunities.title')} right={<Button title={t('applications.title')} variant="ghost" icon="briefcase-outline" onPress={() => router.push('/applications')} style={{ paddingVertical: 6 }} />}>
      <Input placeholder={t('opportunities.search')} value={query} onChangeText={setQuery} autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {OPP_TYPES.map((x) => (
          <Chip key={x.id} label={x.label} selected={type === x.id} onPress={() => setType(x.id)} />
        ))}
      </ScrollView>
      <Row>
        <Chip label={t('opportunities.eligibleOnly')} icon="checkmark" selected={eligibleOnly} onPress={() => setEligibleOnly((v) => !v)} />
        <Chip label={t('opportunities.freeOnly')} icon="pricetag-outline" selected={freeOnly} onPress={() => setFreeOnly((v) => !v)} />
      </Row>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorView error={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? <Empty text={t('common.none')} /> : null}
      {(list.data ?? []).map((o) => {
        const saved = savedIds.has(o.id);
        return (
          <Card key={o.id} onPress={() => router.push(`/opportunity/${o.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge text={oppTypeLabel(o.type)} />
              {o.status === 'closed' ? <Badge text={t('opportunities.closed')} tone="muted" /> : <Badge text={o.cost_aed === 0 ? t('common.free') : t('opportunities.cost', { aed: o.cost_aed })} tone={o.cost_aed === 0 ? 'success' : 'muted'} />}
            </Row>
            <Text variant="heading">{o.title}</Text>
            <Text variant="small" muted>{o.organizer}</Text>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small">{o.deadline ? t('opportunities.deadline', { date: formatDate(o.deadline, lang) }) : t('opportunities.noDeadline')}</Text>
              <View>
                <Button
                  title={saved ? t('opportunities.saved') : t('opportunities.save')}
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  variant={saved ? 'secondary' : 'primary'}
                  disabled={saved || o.status === 'closed'}
                  onPress={() => save(o.id)}
                  style={{ paddingVertical: 8 }}
                />
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
