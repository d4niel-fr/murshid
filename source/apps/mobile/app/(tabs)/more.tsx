import { router, type Href } from 'expo-router';
import React from 'react';
import { Card, Chip, ChipRow, Divider, ListItem, Screen, Section, Text, type IconName } from '@/components/ui';
import { useI18n, type TKey } from '@/i18n';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { curriculumLabel } from '@/lib/labels';

const LINKS: { href: Href; label: TKey; icon: IconName }[] = [
  { href: '/goals', label: 'more.goals', icon: 'flag-outline' },
  { href: '/classes', label: 'more.classes', icon: 'library-outline' },
  { href: '/applications', label: 'more.applications', icon: 'briefcase-outline' },
  { href: '/cv', label: 'more.cv', icon: 'document-text-outline' },
  { href: '/connections', label: 'more.connections', icon: 'link-outline' },
  { href: '/notifications', label: 'more.notifications', icon: 'notifications-outline' },
  { href: '/privacy', label: 'more.privacy', icon: 'lock-closed-outline' },
];

export default function More() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, colors } = useTheme();
  const { student, signOut } = useSession();
  return (
    <Screen title={t('more.title')}>
      {student ? (
        <Card>
          <Text variant="heading">{student.full_name}</Text>
          <Text variant="small" muted>Grade {student.grade} · {curriculumLabel(student.curriculum)}</Text>
        </Card>
      ) : null}
      <Card>
        {LINKS.map((l, i) => (
          <React.Fragment key={l.label}>
            {i ? <Divider /> : null}
            <ListItem title={t(l.label)} icon={l.icon} onPress={() => router.push(l.href)} />
          </React.Fragment>
        ))}
      </Card>
      <Section title={t('more.language')}>
        <ChipRow>
          <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
          <Chip label="العربية" selected={lang === 'ar'} onPress={() => setLang('ar')} />
        </ChipRow>
      </Section>
      <Section title={t('more.appearance')}>
        <ChipRow>
          {(['system', 'light', 'dark'] as const).map((p) => (
            <Chip key={p} label={t(`more.${p}`)} selected={pref === p} onPress={() => setPref(p)} />
          ))}
        </ChipRow>
      </Section>
      <Card>
        <ListItem
          title={t('more.signOut')}
          icon="log-out-outline"
          iconColor={colors.danger}
          onPress={() => {
            signOut();
            router.replace('/');
          }}
        />
      </Card>
    </Screen>
  );
}
