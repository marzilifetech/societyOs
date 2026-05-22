import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

// expo-audio is added by Agent D. Provide a graceful fallback that disables the button.
let _Audio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _Audio = require('expo-audio');
} catch {
  _Audio = null;
}

type Props = {
  onRecorded: (uri: string) => void;
};

export function VoiceNoteRecorder({ onRecorded }: Props) {
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  if (!_Audio) {
    return (
      <View className="bg-gray-100 rounded-full px-3 py-2 self-start">
        <Text className="text-xs text-gray-400">🎙 Voice notes unavailable</Text>
      </View>
    );
  }

  const start = async () => {
    try {
      setBusy(true);
      // expo-audio API surface varies — try the common shape.
      const Recorder = _Audio.Audio?.Recording ?? _Audio.Recording;
      if (!Recorder) throw new Error('Recorder not available');
      const r = new Recorder();
      await r.prepareToRecordAsync(
        _Audio.Audio?.RecordingOptionsPresets?.HIGH_QUALITY ??
          _Audio.RecordingOptionsPresets?.HIGH_QUALITY,
      );
      await r.startAsync();
      setRecorder(r);
      setRecording(true);
    } catch (e) {
      console.warn('voice start failed', e);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!recorder) return;
    try {
      setBusy(true);
      await recorder.stopAndUnloadAsync();
      const uri = recorder.getURI?.();
      if (uri) onRecorded(uri);
    } catch (e) {
      console.warn('voice stop failed', e);
    } finally {
      setRecorder(null);
      setRecording(false);
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={recording ? stop : start}
      className={`rounded-full px-4 py-2 self-start ${recording ? 'bg-red-500' : 'bg-blue-500'}`}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white text-xs font-semibold">
          {recording ? '■ Stop' : '🎙 Record voice note'}
        </Text>
      )}
    </TouchableOpacity>
  );
}
