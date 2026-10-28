import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ChipRow, Input, Screen, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { checkAge } from '@/lib/age';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { colors } = useTheme();
  const { setDob } = useSession();
  const [dob, setDobText] = useState('');
  const [touched, setTouched] = useState(false);
  const gate = checkAge(dob);

  const onContinue = () => {
    setTouched(true);
    if (!gate.ok) return;
    setDob(dob);
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <ChipRow>
        <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
        <Chip label="العربية" selected={lang === 'ar'} onPress={() => setLang('ar')} />
      </ChipRow>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
        <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="compass" size={48} color={colors.primaryText} />
        </View>
        <Text variant="display" style={{ textAlign: 'center' }}>{t('appName')}</Text>
        <Text variant="heading" color={colors.accent} style={{ textAlign: 'center' }}>{t('tagline')}</Text>
        <Text muted style={{ textAlign: 'center' }}>{t('welcome.title')}</Text>
      </View>
      <Card>
        <Input
          label={t('welcome.dobLabel')}
          placeholder={t('welcome.dobHint')}
          value={dob}
          onChangeText={setDobText}
          onBlur={() => setTouched(true)}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          maxLength={10}
          accessibilityHint={t('welcome.dobHint')}
        />
        {touched && !gate.ok && gate.reason === 'invalid' ? <Text variant="small" color={colors.danger}>{t('welcome.dobInvalid')}</Text> : null}
        {!gate.ok && gate.reason === 'too_young' ? <Text variant="small" color={colors.danger}>{t('welcome.tooYoung')}</Text> : null}
        {gate.ok && gate.needsGuardian ? <Text variant="small" muted>{t('welcome.under18Note')}</Text> : null}
        <Button title={t('welcome.getStarted')} onPress={onContinue} disabled={!gate.ok} icon="arrow-forward" />
      </Card>
    </Screen>
  );
}
