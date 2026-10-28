import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user, student } = useSession();
  if (!user || !student) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="planner" options={{ title: t('tabs.planner'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="opportunities" options={{ title: t('tabs.opportunities'), tabBarIcon: icon('rocket-outline') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.chat'), tabBarIcon: icon('chatbubbles-outline') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: icon('grid-outline') }} />
    </Tabs>
  );
}
