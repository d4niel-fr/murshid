import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import { api, type UploadFile } from '@/api';
import { Badge, Button, Card, Chip, Empty, Loading, ListItem, Row, Screen, Section, Text } from '@/components/ui';
import { relativeDay, useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import type { IconName } from '@/components/ui';

const KIND_ICON: Record<string, IconName> = { note: 'document-outline', assignment: 'create-outline', announcement: 'megaphone-outline', exam: 'school-outline' };

export default function Classes() {
  const { t, lang } = useI18n();
  const [courseId, setCourseId] = useState<string | 'all'>('all');
  const [uploading, setUploading] = useState(false);
  const courses = useAsync(() => api.listCourses(), []);
  const materials = useAsync(() => api.listMaterials(courseId === 'all' ? undefined : courseId), [courseId]);
  const target = courseId === 'all' ? courses.data?.[0]?.id : courseId;

  const notify = (msg: string) => (Platform.OS === 'web' ? globalThis.alert?.(msg) : Alert.alert(msg));

  const upload = async (file: UploadFile) => {
    if (!target) return;
    setUploading(true);
    try {
      await api.uploadMaterial({ course_id: target, title: file.name, file });
      materials.reload();
      notify(t('classes.uploaded'));
    } finally {
      setUploading(false);
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await upload({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null });
  };
  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await upload({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null });
  };

  const courseName = (id: string) => courses.data?.find((c) => c.id === id)?.name ?? '';

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t('classes.all')} selected={courseId === 'all'} onPress={() => setCourseId('all')} />
        {(courses.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={courseId === c.id} onPress={() => setCourseId(c.id)} />
        ))}
      </ScrollView>
      <Card>
        <Text variant="heading">{t('classes.upload')}</Text>
        {target ? <Text variant="small" muted>{t('classes.chooseCourse')} → {courseName(target)}</Text> : null}
        <Row>
          <Button title={t('classes.uploadPhoto')} icon="image-outline" variant="secondary" onPress={pickPhoto} loading={uploading} style={{ flex: 1 }} />
          <Button title={t('classes.uploadPdf')} icon="document-attach-outline" variant="secondary" onPress={pickFile} loading={uploading} style={{ flex: 1 }} />
        </Row>
      </Card>
      <Section title={t('classes.title')}>
        <Card>
          {materials.loading && !materials.data ? <Loading /> : (materials.data ?? []).length === 0 ? <Empty text={t('common.none')} /> : null}
          {(materials.data ?? []).map((m) => (
            <ListItem
              key={m.id}
              icon={KIND_ICON[m.kind]}
              title={m.title}
              subtitle={[courseName(m.course_id), m.due_at ? t('common.due', { when: relativeDay(m.due_at, lang) }) : null, m.body_text].filter(Boolean).join(' · ')}
              right={<Badge text={m.source === 'manual' ? 'upload' : m.source.replace('_', ' ')} tone="muted" />}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
