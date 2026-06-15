import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

/**
 * Redesign kit — the rounded, white-surface, serif-heading visual language from
 * the 2026 Figma redesign (file l3RHpqCG1CWEc3Wgkvsj5s). Shared by the
 * redesigned resident screens (Medical SOS, Utility Services, Medical Help Desk,
 * Complaints, Staff Help, Canteen, Notices) + Home.
 *
 * Kept deliberately separate from the flat "paper" primitives
 * (ThemedButton / ThemedCard) so screens NOT part of the redesign keep their
 * existing look. Sizing still flows through useTheme() so Senior Mode scaling
 * keeps working.
 */

// Serif display font — loaded in app/_layout.tsx.
export const serifFont = {
  medium: 'PlayfairDisplay_500Medium',
  semibold: 'PlayfairDisplay_600SemiBold',
  bold: 'PlayfairDisplay_700Bold',
} as const;

// Redesign palette + radii (rounder than the flat paper tokens).
export const rd = {
  radiusCard: 16,
  radiusCardLg: 20,
  radiusInput: 14,
  radiusPill: 999,

  ink: '#141414', // primary CTA (black pill) + Track Request
  inkSoft: '#F2F2F3', // light pill / neutral surface
  crimson: '#C42847', // emergency red — SOS core, danger CTA, "Emergency SOS"
  crimsonSoft: '#FCE9EE', // soft pink behind responder icons + SOS banner
  green: '#2E9E5B', // sent / resolved / acknowledged
  greenSoft: '#E7F4EC',
  amberSoft: '#FBF1D9', // "In Progress" / "Under Review" chips
  amberInk: '#9A6B00',

  cardBorder: 'rgba(0,0,0,0.07)',
  cardShadow: 'rgba(17,17,17,0.06)',
} as const;

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
};

// ---------------------------------------------------------------------------
// Display — serif heading
// ---------------------------------------------------------------------------
type DisplaySize = 'sm' | 'md' | 'lg' | 'xl';
export function Display({
  children,
  size = 'lg',
  color,
  align = 'left',
  weight = 'bold',
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: DisplaySize;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: 'medium' | 'semibold' | 'bold';
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const t = useTheme();
  const sizes: Record<DisplaySize, number> = {
    sm: t.fontXl,
    md: t.font2xl,
    lg: t.font3xl,
    xl: t.font4xl,
  };
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: serifFont[weight],
          fontSize: sizes[size],
          color: color ?? t.textPrimary,
          textAlign: align,
          lineHeight: sizes[size] * 1.22,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// RoundCard — white (or tinted) rounded surface
// ---------------------------------------------------------------------------
type CardTone = 'white' | 'gray' | 'pink' | 'green';
export function RoundCard({
  children,
  tone = 'white',
  padding,
  radius,
  onPress,
  style,
}: {
  children: React.ReactNode;
  tone?: CardTone;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const toneStyle: Record<CardTone, ViewStyle> = {
    white: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: rd.cardBorder, ...softShadow },
    gray: { backgroundColor: '#F5F5F6' },
    pink: { backgroundColor: rd.crimsonSoft, borderWidth: 1, borderColor: 'rgba(196,40,71,0.18)' },
    green: { backgroundColor: rd.greenSoft, borderWidth: 1, borderColor: 'rgba(46,158,91,0.22)' },
  };
  const base: ViewStyle = {
    borderRadius: radius ?? rd.radiusCard,
    padding: padding ?? t.cardPadding,
    ...toneStyle[tone],
  };
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[base, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// PillButton — rounded CTA
// ---------------------------------------------------------------------------
type PillTone = 'dark' | 'danger' | 'light' | 'ghost';
export function PillButton({
  label,
  onPress,
  tone = 'dark',
  size = 'lg',
  loading,
  disabled,
  icon,
  textColor,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: PillTone;
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  textColor?: string;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const height = size === 'lg' ? t.touchTargetLg : t.touchTarget;

  const bg: Record<PillTone, string> = {
    dark: rd.ink,
    danger: rd.crimson,
    light: rd.inkSoft,
    ghost: '#FFFFFF',
  };
  const fg: Record<PillTone, string> = {
    dark: '#FFFFFF',
    danger: '#FFFFFF',
    light: rd.ink,
    ghost: textColor ?? rd.crimson,
  };
  const resolvedText = textColor ?? fg[tone];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        {
          minHeight: height,
          borderRadius: rd.radiusPill,
          backgroundColor: bg[tone],
          borderWidth: tone === 'ghost' ? 1 : 0,
          borderColor: tone === 'ghost' ? 'rgba(0,0,0,0.12)' : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: t.cardPaddingLg,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={resolvedText} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={t.iconSm} color={resolvedText} /> : null}
          <Text
            style={{
              color: resolvedText,
              fontFamily: 'Lato_700Bold',
              fontSize: size === 'lg' ? t.fontBase : t.fontSm,
              fontWeight: '700',
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// IconCircle — colored circular icon chip
// ---------------------------------------------------------------------------
export function IconCircle({
  icon,
  size = 48,
  bg = rd.crimsonSoft,
  color,
  children,
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  bg?: string;
  color?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children ?? (icon ? <Ionicons name={icon} size={size * 0.42} color={color ?? t.accentPrimary} /> : null)}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SegmentedTabs — row of pill tabs (selected = brand maroon)
// ---------------------------------------------------------------------------
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap: 10 }, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              minHeight: t.touchTargetSm,
              paddingHorizontal: 18,
              borderRadius: rd.radiusPill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? t.accentPrimary : '#FFFFFF',
              borderWidth: 1,
              borderColor: active ? t.accentPrimary : 'rgba(0,0,0,0.12)',
            }}
          >
            <Text
              style={{
                color: active ? '#FFFFFF' : t.textPrimary,
                fontSize: t.fontSm,
                fontWeight: '600',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// InfoRows — gray card of label / value rows ("Your Information", summaries)
// ---------------------------------------------------------------------------
export function InfoRows({
  title,
  rows,
  style,
}: {
  title?: string;
  rows: { label: string; value: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <RoundCard tone="gray" padding={t.cardPaddingLg} style={style}>
      {title ? (
        <Text
          style={{ color: t.textMuted, fontSize: t.fontSm, marginBottom: 12 }}
        >
          {title}
        </Text>
      ) : null}
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: i === 0 ? 0 : 12,
          }}
        >
          <Text style={{ color: t.textSecondary, fontSize: t.fontBase }}>{r.label}</Text>
          <Text
            style={{
              color: t.textPrimary,
              fontSize: t.fontBase,
              fontWeight: '700',
              flexShrink: 1,
              textAlign: 'right',
              marginLeft: 12,
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </RoundCard>
  );
}

// ---------------------------------------------------------------------------
// StatusPill — small soft status chip (history, lists)
// ---------------------------------------------------------------------------
export type RdStatusTone = 'active' | 'resolved' | 'cancelled' | 'pending' | 'neutral';
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: RdStatusTone }) {
  const t = useTheme();
  const colors: Record<RdStatusTone, { bg: string; fg: string }> = {
    active: { bg: rd.amberSoft, fg: rd.amberInk },
    pending: { bg: rd.amberSoft, fg: rd.amberInk },
    resolved: { bg: rd.greenSoft, fg: '#1F7A45' },
    cancelled: { bg: rd.crimsonSoft, fg: rd.crimson },
    neutral: { bg: rd.inkSoft, fg: t.textSecondary },
  };
  const c = colors[tone];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 12,
        paddingVertical: 5,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: c.fg, fontSize: t.fontXs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
