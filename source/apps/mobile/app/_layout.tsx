import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '@/i18n';
import { SessionProvider } from '@/state/session';
import { ThemeProvider, useTheme } from '@/theme';

function RootStack() {
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="goals" options={{ title: t('goals.title') }} />
        <Stack.Screen name="classes" options={{ title: t('classes.title') }} />
        <Stack.Screen name="applications" options={{ title: t('applications.title') }} />
        <Stack.Screen name="cv" options={{ title: t('cv.title') }} />
        <Stack.Screen name="connections" options={{ title: t('connections.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="privacy" options={{ title: t('privacy.title') }} />
        <Stack.Screen name="opportunity/[id]" options={{ title: t('opportunities.title') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <SessionProvider>
            <RootStack />
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
