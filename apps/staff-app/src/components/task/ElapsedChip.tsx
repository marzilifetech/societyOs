import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTimerStore, formatElapsed } from '../../store/timer.store';

export function ElapsedChip({ taskId }: { taskId: string }) {
  const elapsed = useTimerStore((s) => s.elapsedSeconds);
  const starts = useTimerStore((s) => s.starts);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!starts[taskId]) return;
    const id = setInterval(() => tick((t: number) => t + 1), 1000);
    return () => clearInterval(id);
  }, [starts, taskId]);

  if (!starts[taskId]) return null;
  return (
    <View className="bg-amber-100 dark:bg-amber-950/60 rounded-full px-2 py-0.5 flex-row items-center">
      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        ⏱ {formatElapsed(elapsed(taskId))}
      </Text>
    </View>
  );
}
