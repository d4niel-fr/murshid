import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Card, Screen, Text } from '@/components/ui';
import { isAuthConfigured, type Provider } from '@/auth';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';

export default function SignIn() {
  const { t } = useI18n();
  const { signIn, signInDemo } = useSession();
  const [busy, setBusy] = useState<Provider | 'demo' | null>(null);

  const go = async (p: Provider) => {
    setBusy(p);
    const ok = await signIn(p);
    setBusy(null);
    if (ok) router.replace('/');
  };
  const demo = async () => {
    setBusy('demo');
    await signInDemo();
    setBusy(null);
    router.replace('/');
  };

  return (
    <Screen title={t('signIn.title')}>
      <Text muted>{t('signIn.subtitle')}</Text>
      <Card>
        <Button title={t('signIn.google')} icon="logo-google" variant="secondary" loading={busy === 'google'} onPress={() => go('google')} />
        <Button title={t('signIn.microsoft')} icon="logo-microsoft" variant="secondary" loading={busy === 'azure'} onPress={() => go('azure')} />
      </Card>
      {!isAuthConfigured ? <Text variant="small" muted>{t('signIn.placeholderNote')}</Text> : null}
      <Button title={t('signIn.demo')} variant="ghost" icon="person-circle-outline" loading={busy === 'demo'} onPress={demo} />
    </Screen>
  );
}
