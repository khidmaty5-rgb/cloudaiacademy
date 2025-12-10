import type { Timestamp } from 'firebase/firestore';

// Minimal type for scheduled live sessions under a course
// Firestore path suggestion: courses/{courseId}/liveSessions/{sessionId}
export interface LiveSession {
  roomName: string;        // e.g., "CloudAIAcademy-<courseId>"
  startTime: Timestamp;    // when the session starts
  durationMinutes: number; // planned duration
  hostUserId: string;      // UID of the teacher/admin host
}
