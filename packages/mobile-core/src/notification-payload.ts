/**
 * Reading push payloads the same way everywhere.
 *
 * The backend has sent the target record under four different keys over time
 * (`entityId`, `id`, `visitId`, `alertId` — SOS still sends only `alertId`).
 * Every consumer re-implemented the fallback chain with a different subset of
 * keys, which is how an SOS tap ended up with no id and opened an empty list.
 */

export type NotificationData = Record<string, unknown>;

/** The `data` object of a push, or `{}` when it is missing or not an object. */
export function readNotificationData(raw: unknown): NotificationData {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as NotificationData) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The record a push is about, whichever key the backend used. */
export function notificationEntityId(data: NotificationData): string | undefined {
  return str(data.entityId) ?? str(data.id) ?? str(data.visitId) ?? str(data.alertId);
}

/** `data.type`, when it is a non-empty string. */
export function notificationType(data: NotificationData): string | undefined {
  return str(data.type);
}

export interface BannerPayloadInput {
  identifier: string;
  title?: string | null;
  body?: string | null;
  data: unknown;
  /** iOS attachments, when present. */
  attachments?: { url?: string }[] | null;
}

export interface BannerPayload {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: string;
  entityId?: string;
  actionGroup?: string;
  data: NotificationData;
}

/** Normalises a received notification into what the in-app banner renders. */
export function toBannerPayload(input: BannerPayloadInput): BannerPayload {
  const data = readNotificationData(input.data);
  return {
    id: input.identifier,
    title: input.title ?? 'Notification',
    body: input.body ?? '',
    imageUrl: str(data.imageUrl) ?? str(input.attachments?.[0]?.url),
    type: notificationType(data),
    entityId: notificationEntityId(data),
    actionGroup: str(data.actionGroup),
    data,
  };
}
