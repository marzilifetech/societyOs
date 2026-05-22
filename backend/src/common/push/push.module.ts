/**
 * Re-exports the global FCM `PushModule` from `common/notification`.
 * Modules that still import `../../common/push/push.module` get the same
 * `@Global()` provider graph without duplicating Nest providers.
 */
export { PushModule } from '../notification/push.module';
