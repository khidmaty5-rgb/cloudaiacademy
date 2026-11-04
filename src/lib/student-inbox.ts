export const INBOX_FILE_LIMIT = 2_000_000;
export const INBOX_BODY_LIMIT = 2_800_000;
export const inboxStatuses = ['under_review', 'reviewed', 'needs_changes'] as const;
export type InboxStatus = typeof inboxStatuses[number];
export type InboxItem = { id: string; courseId: string; kind: 'assignment' | 'question'; name: string; title: string; message: string; status: InboxStatus | 'processing'; reply: string; createdAt: string; revision: number; hasFile: boolean };
export function inboxText(value: unknown, maximum: number, required = true): string {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) throw new Error('INVALID_REQUEST');
  return value.trim();
}
export function validReceipt(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
