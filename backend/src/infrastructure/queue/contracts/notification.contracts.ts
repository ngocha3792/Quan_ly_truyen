export const SEND_NOTIFICATION_JOB = 'notifications.send.v1';

export interface SendNotificationJobV1 {
  version: 1;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  correlationId?: string;
}
