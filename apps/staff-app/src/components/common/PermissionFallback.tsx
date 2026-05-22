import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  permission: string;
  onRetry?: () => void;
  loading?: boolean;
};

export function PermissionFallback({ permission, onRetry, loading }: Props) {
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-black items-center justify-center px-8">
      <Text className="text-white text-center text-base mb-6">
        {permission} permission is required to capture proof-of-work photos.
      </Text>
      {onRetry && (
        <TouchableOpacity className="bg-white rounded-2xl px-6 py-3" onPress={onRetry}>
          <Text className="text-gray-900 font-semibold">Grant Access</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
