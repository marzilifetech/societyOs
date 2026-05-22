import { View, Text } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';

type Props = {
  data: number[]; // 30-day daily averages, 0..5
  width?: number;
  height?: number;
};

export function TrendChart({ data, width = 320, height = 120 }: Props) {
  // Coerce non-finite entries (null/undefined/NaN from API) to 0 — passing NaN
  // into <Polyline points> produces "M12 NaN ..." which crashes RNSVGPathParser.
  const safe = (data ?? []).map((v) => (Number.isFinite(v) ? v : 0));
  if (safe.length === 0) {
    return (
      <View className="bg-gray-50 rounded-xl py-8 items-center">
        <Text className="text-gray-400 text-xs">No trend data</Text>
      </View>
    );
  }

  const max = 5;
  const padX = 12;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const stepX = safe.length > 1 ? innerW / (safe.length - 1) : 0;
  const points = safe
    .map((v, i) => {
      const x = padX + i * stepX;
      const y = padY + innerH - (Math.max(0, Math.min(max, v)) / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Line
            key={i}
            x1={padX}
            y1={padY + (innerH * i) / 4}
            x2={width - padX}
            y2={padY + (innerH * i) / 4}
            stroke="#F3F4F6"
            strokeWidth={1}
          />
        ))}
        <Polyline points={points} fill="none" stroke="#821A52" strokeWidth={2} />
        {safe.map((v, i) => {
          const x = padX + i * stepX;
          const y = padY + innerH - (Math.max(0, Math.min(max, v)) / max) * innerH;
          return <Circle key={i} cx={x} cy={y} r={2} fill="#821A52" />;
        })}
      </Svg>
      <View className="flex-row justify-between px-3 mt-1">
        <Text className="text-[10px] text-gray-400">30 days ago</Text>
        <Text className="text-[10px] text-gray-400">Today</Text>
      </View>
    </View>
  );
}
