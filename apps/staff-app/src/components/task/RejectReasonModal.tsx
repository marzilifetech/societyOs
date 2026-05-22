import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
  loading?: boolean;
};

export function RejectReasonModal({ visible, onCancel, onSubmit, loading }: Props) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6 pb-10">
          <Text className="text-lg font-bold text-gray-900 mb-1">Reject Task</Text>
          <Text className="text-xs text-gray-400 mb-4">
            Tell the admin why this task can't be completed.
          </Text>
          <TextInput
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-900"
            style={{ textAlignVertical: 'top', minHeight: 100 }}
          />
          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity
              className="flex-1 bg-gray-100 rounded-2xl py-3 items-center"
              onPress={() => {
                setReason('');
                onCancel();
              }}
              disabled={loading}
            >
              <Text className="text-gray-700 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-2xl py-3 items-center ${reason.trim().length < 5 ? 'bg-red-300' : 'bg-red-500'}`}
              disabled={reason.trim().length < 5 || loading}
              onPress={() => onSubmit(reason.trim())}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
