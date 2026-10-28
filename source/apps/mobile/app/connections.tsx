import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { api, type ConnectionProvider } from '@/api';
import { Badge, Button, Card, Loading, ListItem, Screen, Text, type IconName } from '@/components/ui';
import { relativeDay, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

const PROVIDERS: { id: ConnectionProvider; icon: IconName; desc: string }[] = [
  { id: 'google_classroom', icon: 'school-outline', desc: 'Classes, assignments and announcements' },
  { id: 'teams', icon: 'people-outline', desc: 'Microsoft Teams classes & assignments' },
  { id: 'google_calendar', icon: 'calendar-outline', desc: 'Busy times so plans fit your day' },
  { id: 'uae_pass', icon: 'finger-print-outline', desc: 'Verified identity for applications' },
  { id: 'linkedin', icon: 'logo-linkedin', desc: 'Share your CV and achievements' },
];

export default function Connections() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { canShare } = useSession();
  const list = useAsync(() => api.listConnections(), []);
  const [busy, setBusy] = useState<ConnectionProvider | null>(null);

  const toggle = async (p: ConnectionProvider, connected: boolean) => {
    setBusy(p);
    try {
      if (connected) await api.disconnect(p);
      else {
        // Real flow: apps/api returns an OAuth URL from packages/connectors; tokens stay server-side (token_ref only).
        const { authUrl } = await api.connect(p);
        if (authUrl) await WebBrowser.openAuthSessionAsync(authUrl);
      }
      await list.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {!canShare ? (
        <Card onPress={() => router.push('/consent')} style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Text variant="heading">{t('consent.locked')}</Text>
          <Text variant="small" muted>{t('consent.body')}</Text>
        </Card>
      ) : null}
      {list.loading && !list.data ? <Loading /> : null}
      {PROVIDERS.map((p) => {
        const c = list.data?.find((x) => x.provider === p.id);
        const connected = c?.status === 'connected';
        return (
          <Card key={p.id}>
            <ListItem
              icon={p.icon}
              title={t(`connections.${p.id}`)}
              subtitle={connected && c?.last_sync_at ? t('connections.lastSync', { when: relativeDay(c.last_sync_at, lang) }) : p.desc}
              right={connected ? <Badge text={t('connections.connected')} tone="success" /> : undefined}
            />
            <Button
              title={connected ? t('connections.disconnect') : t('connections.connect')}
              variant={connected ? 'ghost' : 'primary'}
              disabled={!connected && !canShare}
              loading={busy === p.id}
              onPress={() => toggle(p.id, connected)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
