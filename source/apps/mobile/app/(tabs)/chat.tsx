import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { Card, Input, Screen, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

// AI-LATER: conversation with the Murshid agent via packages/agent-gateway. No model calls in this phase.
export default function Chat() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Screen title={t('chat.title')}>
      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={34} color={colors.primary} />
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>{t('chat.coming')}</Text>
        <Text muted style={{ textAlign: 'center' }}>{t('chat.body')}</Text>
      </Card>
      <Input placeholder={t('chat.placeholder')} editable={false} />
    </Screen>
  );
}
