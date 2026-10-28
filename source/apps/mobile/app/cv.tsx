import React, { useState } from 'react';
import { View } from 'react-native';
import { api, type AchievementCategory, type CvTarget, type CvVersion } from '@/api';
import { Badge, Button, Card, Chip, ChipRow, Divider, Input, ListItem, Loading, Screen, Section, Text } from '@/components/ui';
import { formatDate, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useTheme } from '@/theme';

const CATS: AchievementCategory[] = ['academic', 'award', 'sport', 'project', 'volunteering', 'work', 'certificate', 'leadership'];

export default function Cv() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const achievements = useAsync(() => api.listAchievements(), []);
  const [target, setTarget] = useState<CvTarget>('general');
  const [cv, setCv] = useState<CvVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<AchievementCategory>('award');

  const generate = async () => {
    setBusy(true);
    setCv(await api.generateCv(target));
    setBusy(false);
  };
  const add = async () => {
    await api.addAchievement({ title: title.trim(), category: cat, date: new Date().toISOString().slice(0, 10), description: '', evidence_url: null });
    setTitle('');
    achievements.reload();
  };

  const r = cv?.json;
  const block = (heading: string, items: { a: string; b?: string }[] | undefined) =>
    items && items.length ? (
      <View style={{ gap: 4 }}>
        <Text variant="label" color={colors.primary}>{heading.toUpperCase()}</Text>
        {items.map((x, i) => (
          <View key={i}>
            <Text style={{ fontWeight: '600' }}>{x.a}</Text>
            {x.b ? <Text variant="small" muted>{x.b}</Text> : null}
          </View>
        ))}
      </View>
    ) : null;

  return (
    <Screen>
      <Section title={t('cv.achievements')}>
        <Card>
          {achievements.loading && !achievements.data ? <Loading /> : null}
          {(achievements.data ?? []).map((a, i) => (
            <React.Fragment key={a.id}>
              {i ? <Divider /> : null}
              <ListItem icon="trophy-outline" title={a.title} subtitle={`${formatDate(a.date, lang, { month: 'short', year: 'numeric' })}${a.description ? ' · ' + a.description : ''}`} right={<Badge text={a.category} tone="muted" />} />
            </React.Fragment>
          ))}
        </Card>
        <Card>
          <Input placeholder={t('cv.achievementTitle')} value={title} onChangeText={setTitle} />
          <ChipRow>{CATS.map((c) => <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} />)}</ChipRow>
          <Button title={t('cv.addAchievement')} icon="add" variant="secondary" onPress={add} disabled={!title.trim()} />
        </Card>
      </Section>

      <Section title={t('cv.generate')}>
        <Text variant="label" muted>{t('cv.target')}</Text>
        <ChipRow>
          {(['general', 'university', 'internship'] as const).map((x) => (
            <Chip key={x} label={t(`cv.${x}`)} selected={target === x} onPress={() => setTarget(x)} />
          ))}
        </ChipRow>
        <Button title={t('cv.generate')} icon="document-text-outline" onPress={generate} loading={busy} />
        <Text variant="small" muted>{t('cv.ruleBasedNote')}</Text>
      </Section>

      {r ? (
        <Section title={t('cv.preview')}>
          <Card style={{ gap: 14 }}>
            <View>
              <Text variant="title">{r.basics.name}</Text>
              {r.basics.label ? <Text muted>{r.basics.label}</Text> : null}
              {r.basics.summary ? <Text variant="small" style={{ marginTop: 6 }}>{r.basics.summary}</Text> : null}
            </View>
            <Divider />
            {block('Education', r.education?.map((e) => ({ a: e.institution, b: [e.studyType, e.area].filter(Boolean).join(' · ') })))}
            {block('Awards & academics', r.awards?.map((x) => ({ a: x.title, b: x.summary })))}
            {block('Projects & leadership', r.projects?.map((x) => ({ a: x.name, b: x.description })))}
            {block('Volunteering', r.volunteer?.map((x) => ({ a: x.organization, b: x.summary })))}
            {block('Experience', r.work?.map((x) => ({ a: x.name, b: x.summary })))}
            {block('Certificates', r.certificates?.map((x) => ({ a: x.name, b: x.date })))}
            {block('Skills', r.skills?.length ? [{ a: r.skills.map((s) => s.name).join(', ') }] : undefined)}
            {block('Interests', r.interests?.length ? [{ a: r.interests.map((s) => s.name).join(', ') }] : undefined)}
            {block('Languages', r.languages?.length ? [{ a: r.languages.map((s) => s.language).join(', ') }] : undefined)}
            {/* PDF rendering comes from packages/documents (cv.pdf_url) */}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
