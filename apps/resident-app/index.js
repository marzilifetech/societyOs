// Registers the FCM background handler (module side effect) BEFORE the app
// loads, then hands off to expo-router. See src/lib/fullScreenNotifications.ts.
import './src/lib/fullScreenNotifications';
import 'expo-router/entry';
