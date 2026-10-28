import React from 'react';
import { api, type NotificationChannel, type NotificationPrefs } from '@/api';
import { Card, Chip, ChipRow, Divider, Loading, Screen, Section, SwitchRow, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/state/session';

const CHANNELS: NotificationChannel[] = ['push', 'email', 'whatsapp', 'in_app'];
const TIMES = ['06:30', '06:45', '07:00', '07:30', '16:00'];

export default function Notifications() {
  const { t } = useI18n();
  const { canShare } = useSession();
  const prefs = useAsync(() => api.getNotificationPrefs(), []);

  const update = async (patch: Partial<NotificationPrefs>) => {
    prefs.setData((p) => (p ? { ...p, ...patch, channels: { ...p.channels, ...(patch.channels ?? {}) } } : p));
    await api.updateNotificationPrefs(patch);
  };

  const p = prefs.data;
  if (!p) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <Section title={t('notifications.channels')}>
        <Card>
          {CHANNELS.map((c, i) => (
            <React.Fragment key={c}>
              {i ? <Divider /> : null}
              <SwitchRow label={t(`notifications.${c}`)} value={p.channels[c]} onChange={(v) => update({ channels: { ...p.channels, [c]: v } })} />
            </React.Fragment>
          ))}
        </Card>
      </Section>
      <Card>
        <SwitchRow label={t('notifications.dailyBriefing')} value={p.daily_briefing} onChange={(v) => update({ daily_briefing: v })} />
        {p.daily_briefing ? (
          <>
            <Text variant="label" muted>{t('notifications.briefingTime')} (Asia/Dubai)</Text>
            <ChipRow>{TIMES.map((x) => <Chip key={x} label={x} selected={p.briefing_time === x} onPress={() => update({ briefing_time: x })} />)}</ChipRow>
          </>
        ) : null}
        <Divider />
        <SwitchRow label={t('notifications.deadlineReminders')} value={p.deadline_reminders} onChange={(v) => update({ deadline_reminders: v })} />
        <Divider />
        <SwitchRow label={t('notifications.newOpportunities')} value={p.new_opportunities} onChange={(v) => update({ new_opportunities: v })} />
        <Divider />
        <SwitchRow
          label={t('notifications.guardianSummary')}
          value={p.weekly_summary_to_guardian}
          onChange={(v) => update({ weekly_summary_to_guardian: v })}
          disabled={!canShare}
          hint={!canShare ? t('consent.locked') : undefined}
        />
      </Card>
      <Text variant="small" muted>{t('notifications.quietHours', { start: p.quiet_hours.start, end: p.quiet_hours.end })}</Text>
    </Screen>
  );
}
