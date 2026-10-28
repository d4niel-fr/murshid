import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { api, isMock } from '@/api';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function ConsentPending() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const session = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session.user) return <Redirect href="/" />;
  const g = session.guardian;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    setBusy(true);
    const guardian = await api.requestGuardianConsent({ name: name.trim(), email: email.trim(), relation: relation.trim() || 'guardian' });
    session.setGuardian(guardian);
    setBusy(false);
  };

  const simulate = async () => {
    if (isMock(api)) api.simulateGuardianApproval();
    await session.refreshGuardian();
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 16 }}>
        <Ionicons name={g?.consent_status === 'granted' ? 'shield-checkmark' : 'shield-half-outline'} size={56} color={colors.primary} />
        <Text variant="title" style={{ textAlign: 'center' }}>{t('consent.title')}</Text>
        <Text muted style={{ textAlign: 'center' }}>{t('consent.body')}</Text>
      </View>

      {!g ? (
        <Card>
          <Input label={t('consent.guardianName')} value={name} onChangeText={setName} />
          <Input label={t('consent.guardianEmail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label={t('consent.relation')} value={relation} onChangeText={setRelation} />
          <Button title={t('consent.send')} icon="mail-outline" onPress={send} loading={busy} disabled={name.trim().length < 2 || !validEmail} />
        </Card>
      ) : g.consent_status === 'granted' ? (
        <Card>
          <Text variant="heading" color={colors.success}>{t('consent.granted')}</Text>
          <Button title={t('common.continue')} onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <Card>
          <Text variant="heading">{t('consent.pending', { name: g.name })}</Text>
          <Text muted variant="small">{t('consent.pendingHint', { email: g.email })}</Text>
          <Button title={t('common.retry')} variant="secondary" icon="refresh" onPress={session.refreshGuardian} />
          {isMock(api) ? <Button title={t('consent.simulate')} variant="ghost" onPress={simulate} /> : null}
        </Card>
      )}

      {g?.consent_status !== 'granted' ? (
        <Button
          title={t('consent.continueLimited')}
          variant="ghost"
          onPress={() => {
            session.deferConsent();
            router.replace('/home');
          }}
        />
      ) : null}
    </Screen>
  );
}
