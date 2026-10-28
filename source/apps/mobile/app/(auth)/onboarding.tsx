import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { api, type Curriculum, type Emirate, type School } from '@/api';
import { Button, Card, Chip, ChipRow, Input, ListItem, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

const CURRICULA: { id: Curriculum; label: string }[] = [
  { id: 'british', label: 'British (IGCSE / A-level)' },
  { id: 'indian_cbse', label: 'Indian – CBSE' },
  { id: 'indian_icse', label: 'Indian – ICSE' },
  { id: 'american', label: 'American' },
  { id: 'ib', label: 'IB' },
  { id: 'uae_moe', label: 'UAE MoE' },
  { id: 'other', label: 'Other' },
];
const EMIRATES: { id: Emirate; label: string }[] = [
  { id: 'abu_dhabi', label: 'Abu Dhabi' },
  { id: 'dubai', label: 'Dubai' },
  { id: 'sharjah', label: 'Sharjah' },
  { id: 'ajman', label: 'Ajman' },
  { id: 'umm_al_quwain', label: 'Umm Al Quwain' },
  { id: 'ras_al_khaimah', label: 'Ras Al Khaimah' },
  { id: 'fujairah', label: 'Fujairah' },
];
const INTEREST_SUGGESTIONS = ['medicine', 'engineering', 'robotics', 'coding', 'business', 'law', 'design', 'debate', 'sport', 'music', 'environment', 'volunteering', 'maths', 'writing'];
const TOTAL = 5;

export default function Onboarding() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const session = useSession();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [preferred, setPreferred] = useState('');
  const [nationality, setNationality] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [school, setSchool] = useState<School | null>(null);
  const [emirate, setEmirate] = useState<Emirate | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [goals, setGoals] = useState('');
  const [saving, setSaving] = useState(false);
  const schools = useAsync(() => api.listSchools(schoolQuery), [schoolQuery]);

  if (!session.user) return <Redirect href="/" />;

  const canNext =
    (step === 1 && fullName.trim().length > 1) ||
    (step === 2 && (!!school || !!emirate)) ||
    (step === 3 && grade !== null && curriculum !== null) ||
    (step === 4 && interests.length > 0) ||
    step === 5;

  const toggleInterest = (i: string) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const finish = async () => {
    setSaving(true);
    await session.completeOnboarding({
      full_name: fullName.trim(),
      preferred_name: preferred.trim() || fullName.trim().split(' ')[0],
      date_of_birth: session.dob ?? '',
      grade: grade ?? 9,
      school_id: school?.id ?? null,
      curriculum: curriculum ?? 'other',
      emirate: emirate ?? school?.emirate ?? null,
      nationality: nationality.trim() || null,
      languages: [],
      interests,
      strengths: [],
      goals_text: goals.trim(), // API turns plain-words goals into Goal rows. AI-LATER: goal parsing.
    });
    setSaving(false);
    router.replace('/');
  };

  return (
    <Screen>
      <Text variant="label" muted>{t('onboarding.step', { n: step, total: TOTAL })}</Text>
      <ProgressBar value={(step / TOTAL) * 100} />

      {step === 1 && (
        <Card>
          <Text variant="title">{t('onboarding.identityTitle')}</Text>
          <Input label={t('onboarding.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" />
          <Input label={t('onboarding.preferredName')} value={preferred} onChangeText={setPreferred} />
          <Input label={t('onboarding.nationality')} value={nationality} onChangeText={setNationality} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Text variant="title">{t('onboarding.schoolTitle')}</Text>
          <Input placeholder={t('onboarding.searchSchool')} value={schoolQuery} onChangeText={setSchoolQuery} />
          {(schools.data ?? []).map((s) => (
            <ListItem
              key={s.id}
              icon={school?.id === s.id ? 'checkmark-circle' : 'school-outline'}
              title={s.name}
              subtitle={EMIRATES.find((e) => e.id === s.emirate)?.label}
              onPress={() => {
                setSchool(s);
                setEmirate(s.emirate);
              }}
              right={<View />}
            />
          ))}
          <Text variant="label" muted>{t('onboarding.emirate')}</Text>
          <ChipRow>
            {EMIRATES.map((e) => (
              <Chip key={e.id} label={e.label} selected={emirate === e.id} onPress={() => setEmirate(e.id)} />
            ))}
          </ChipRow>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Text variant="title">{t('onboarding.gradeTitle')}</Text>
          <Text variant="label" muted>{t('onboarding.grade')}</Text>
          <ChipRow>
            {[6, 7, 8, 9, 10, 11, 12, 13].map((g) => (
              <Chip key={g} label={String(g)} selected={grade === g} onPress={() => setGrade(g)} />
            ))}
          </ChipRow>
          <Text variant="label" muted>{t('onboarding.curriculum')}</Text>
          <ChipRow>
            {CURRICULA.map((c) => (
              <Chip key={c.id} label={c.label} selected={curriculum === c.id} onPress={() => setCurriculum(c.id)} />
            ))}
          </ChipRow>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <Text variant="title">{t('onboarding.interestsTitle')}</Text>
          <Text muted>{t('onboarding.interestsHint')}</Text>
          <ChipRow>
            {[...new Set([...INTEREST_SUGGESTIONS, ...interests])].map((i) => (
              <Chip key={i} label={i} selected={interests.includes(i)} onPress={() => toggleInterest(i)} />
            ))}
          </ChipRow>
          <Row>
            <View style={{ flex: 1 }}>
              <Input placeholder={t('onboarding.addInterest')} value={custom} onChangeText={setCustom} onSubmitEditing={() => { if (custom.trim()) { toggleInterest(custom.trim().toLowerCase()); setCustom(''); } }} />
            </View>
            <Button title="+" variant="secondary" onPress={() => { if (custom.trim()) { toggleInterest(custom.trim().toLowerCase()); setCustom(''); } }} />
          </Row>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <Text variant="title">{t('onboarding.goalsTitle')}</Text>
          <Text muted variant="small">{t('onboarding.goalsHint')}</Text>
          <Input value={goals} onChangeText={setGoals} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} />
        </Card>
      )}

      <Row>
        {step > 1 ? <Button title={t('common.back')} variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button
          title={step === TOTAL ? t('onboarding.finish') : t('common.continue')}
          onPress={() => (step === TOTAL ? finish() : setStep(step + 1))}
          disabled={!canNext}
          loading={saving}
          style={{ flex: 2 }}
        />
      </Row>
      {!session.dob ? <Text variant="small" color={colors.danger}>{t('welcome.dobInvalid')}</Text> : null}
    </Screen>
  );
}
