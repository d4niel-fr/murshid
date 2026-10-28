import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { api } from '@/api';
import { Badge, Button, Card, Divider, ListItem, Loading, Screen, Section, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function Privacy() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { signOut } = useSession();
  const log = useAsync(() => api.listAiUseLog(), []);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);

  const doExport = async () => {
    setBusy('export');
    const r = await api.exportData();
    setBusy(null);
    setExportMsg(`${t('privacy.exportDone')} · ${formatDate(r.generated_at, lang, { dateStyle: 'medium', timeStyle: 'short' })}${r.url ? '' : ' (demo: no file)'}`);
    log.reload();
  };

  const doDelete = async () => {
    setBusy('delete');
    const r = await api.deleteAccount();
    setBusy(null);
    const msg = t('privacy.deleteScheduled', { date: formatDate(r.scheduled_for, lang, { dateStyle: 'medium' }) });
    if (Platform.OS === 'web') globalThis.alert?.(msg);
    else Alert.alert(msg);
    signOut();
    router.replace('/');
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('privacy.deleteConfirm'))) doDelete();
      return;
    }
    Alert.alert(t('privacy.delete'), t('privacy.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('privacy.delete'), style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <Screen>
      <Card>
        <Button title={t('privacy.export')} icon="download-outline" variant="secondary" onPress={doExport} loading={busy === 'export'} />
        {exportMsg ? <Text variant="small" color={colors.success}>{exportMsg}</Text> : null}
        <Button title={t('privacy.delete')} icon="trash-outline" variant="danger" onPress={confirmDelete} loading={busy === 'delete'} />
      </Card>
      <Section title={t('privacy.aiLog')}>
        <Text variant="small" muted>{t('privacy.aiLogHint')}</Text>
        <Card>
          {log.loading && !log.data ? <Loading /> : null}
          {(log.data ?? []).map((e, i) => (
            <React.Fragment key={e.id}>
              {i ? <Divider /> : null}
              <ListItem
                icon={e.actor.startsWith('connector') ? 'link-outline' : e.actor.startsWith('agent') ? 'sparkles-outline' : 'person-outline'}
                title={`${e.actor} — ${e.action}`}
                subtitle={`${e.resource} · ${formatDate(e.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                right={e.ai_use_level ? <Badge text={`AI: ${e.ai_use_level}`} tone={e.ai_use_level === 'none' ? 'muted' : 'accent'} /> : undefined}
              />
            </React.Fragment>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
