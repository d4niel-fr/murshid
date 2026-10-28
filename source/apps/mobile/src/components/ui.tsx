import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isMock } from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'label';
export function Text({
  variant = 'body',
  muted,
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  const { colors, type } = useTheme();
  const { flip: isRTL } = useI18n();
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[type[variant], { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }, style]}
    >
      {children}
    </RNText>
  );
}

/** Row that flips in RTL (works on web too, where I18nManager doesn't flip flexbox). */
export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  const { flip: isRTL } = useI18n();
  return <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Screen({
  children,
  scroll = true,
  title,
  right,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  title?: string;
  right?: React.ReactNode;
  padded?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const { t } = useI18n();
  const header = title ? (
    <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
      <Row gap={8}>
        <Text variant="title">{title}</Text>
        {isMock() ? <Badge text={t('common.mockBadge')} tone="accent" /> : null}
      </Row>
      {right}
    </Row>
  ) : null;
  const inner = (
    <View style={{ padding: padded ? spacing.lg : 0, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      {header}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : <View style={{ flex: 1 }}>{inner}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm };
  if (onPress)
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const { flip: isRTL } = useI18n();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = { primary: colors.primaryText, secondary: colors.text, ghost: colors.primary, danger: '#fff' }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: 18,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{title}</RNText>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.primaryText : colors.text} /> : null}
      <RNText style={{ color: selected ? colors.primaryText : colors.text, fontSize: 13, fontWeight: '600' }}>{label}</RNText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  const { flip: isRTL } = useI18n();
  return <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function Badge({ text, tone = 'primary' }: { text: string; tone?: 'primary' | 'accent' | 'danger' | 'success' | 'muted' }) {
  const { colors, radius } = useTheme();
  const map = {
    primary: [colors.primarySoft, colors.primary],
    accent: [colors.accentSoft, colors.accent],
    danger: [colors.danger + '22', colors.danger],
    success: [colors.success + '22', colors.success],
    muted: [colors.surfaceAlt, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <RNText style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{text}</RNText>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { colors, radius } = useTheme();
  const { flip: isRTL } = useI18n();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <View style={{ width: `${pct}%`, backgroundColor: color ?? colors.primary, borderRadius: radius.pill }} />
    </View>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { colors, radius } = useTheme();
  const { flip: isRTL } = useI18n();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label" muted>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
          },
          style,
        ]}
      />
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  icon,
  right,
  onPress,
  iconColor,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
  onPress?: () => void;
  iconColor?: string;
}) {
  const { colors, radius } = useTheme();
  const { flip: isRTL } = useI18n();
  const content = (
    <Row gap={12} style={{ paddingVertical: 10 }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" muted numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} /> : null)}
    </Row>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function SwitchRow({ label, value, onChange, disabled, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint ? <Text variant="small" muted>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={label} />
    </Row>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{title}</Text>
        {action}
      </Row>
      {children}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <Text variant="heading">{t('common.error')}</Text>
      <Text muted variant="small">{error.message}</Text>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Empty({ text, icon = 'sparkles-outline' }: { text: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
      <Ionicons name={icon} size={28} color={colors.textMuted} />
      <Text muted style={{ textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle}>
      <Row gap={10} style={{ paddingVertical: 6 }}>
        <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={checked ? colors.success : colors.textMuted} />
        <Text style={[{ flex: 1 }, checked ? { textDecorationLine: 'line-through', color: colors.textMuted } : null]}>{label}</Text>
      </Row>
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}
