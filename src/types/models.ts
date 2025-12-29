import type { FieldValue, Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp | FieldValue | Date | null;
export type UserRole = 'student' | 'teacher' | 'editor' | 'admin';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LivePlatform = 'jitsi' | 'google-meet' | 'none';
export type CourseStatus = 'DRAFT' | 'PUBLISHED';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  dateJoined?: FirestoreTimestamp;
  requirePayment?: boolean;
}

export interface Course {
  id: string;
  slug: string;
  /** Controls public visibility. Defaults to `PUBLISHED` when omitted (legacy data). */
  status?: CourseStatus;
  /** Short, human-friendly code used for certificates (e.g. AWSFND, PY101). */
  courseCode?: string;
  /** If true, students must join a waiting list instead of enrolling directly. */
  isFull?: boolean;
  title: string;
  description: string;
  category: string;
  price: string;
  duration: string;
  /** Optional nominal duration in hours used for certificates. */
  totalHours?: number;
  level: CourseLevel;
  imageId: string;
  /** Optional explicit image URL (e.g. `/images/course.png`). Overrides placeholder images. */
  imageUrl?: string;
  // Optional teacher association
  ownerId?: string;          // primary instructor/creator uid
  instructorIds?: string[];  // additional instructors if any
  // Live session configuration
  livePlatform?: LivePlatform;
  liveJitsiRoom?: string | null;
  liveMeetUrl?: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  title_ar?: string;
  content_ar?: string;
  embedUrl?: string | null;
  // Optional lesson worksheet/whiteboard PDF stored in S3/MinIO (key path)
  pdfPath?: string | null;
  order?: number;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  // Optional integrations per lesson
  whiteboardPlatform?: 'excalidraw' | 'miro' | 'ms-whiteboard';
  whiteboardUrl?: string | null;
  codingPlatform?: 'replit' | 'codesandbox' | 'stackblitz' | 'colab' | 'livecodes';
  codingUrl?: string | null;
  labPlatform?: 'labex' | 'whizlabs' | 'vmware-hol' | 'virtual-labs';
  labUrl?: string | null;
}

export interface Enrollment {
  id?: string;
  userId: string;
  courseId: string;
  enrollmentDate?: FirestoreTimestamp;
  progress: number;
  completedLessons: string[];
}

export type EnrollmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface EnrollmentRequest {
  /** Document ID, typically the courseId (slug). */
  id?: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  courseId: string;
  courseTitle?: string | null;
  courseCode?: string | null;
  status: EnrollmentRequestStatus;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  approvedAt?: FirestoreTimestamp;
  rejectedAt?: FirestoreTimestamp;
}

export interface LearningPath {
  id?: string;
  userId: string;
  title: string;
  description: string;
  courseIds?: string[];
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt?: FirestoreTimestamp;
  createdBy: string;
}

export type CertificateStatus = 'ACTIVE' | 'REVOKED';

export type CertificateRecipientNameStyle =
  | 'CALLIGRAPHY'
  | 'GABRIOLA'
  | 'EDWARDIAN'
  | 'FRENCH_SCRIPT'
  | 'SERIF'
  | 'SANS';

export interface Certificate {
  /** Certificate ID, also used as the Firestore document ID. */
  id: string;
  userId: string;
  userName: string;
  userEmail?: string | null;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  totalHours: number;
  completedAt: FirestoreTimestamp;
  issuedAt?: FirestoreTimestamp;
  issuedBy: string;
  instructorName: string;
  instructorTitle?: string;
  authorizedByName: string;
  authorizedByTitle?: string;
  /**
   * Controls how the recipient name is rendered on the certificate.
   * Defaults to `CALLIGRAPHY` when omitted.
   */
  recipientNameStyle?: CertificateRecipientNameStyle;
  status: CertificateStatus;
  revokedAt?: FirestoreTimestamp;
  /** Optional generated certificate PDF key in S3/MinIO (e.g. certificates/{uid}/{id}.pdf). */
  pdfPath?: string | null;
  /** Optional app download URL for the generated PDF (e.g. /api/certificates/{id}/download). */
  pdfUrl?: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export type JournalArticleStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'PUBLISHED';

export type JournalReviewRecommendation =
  | 'ACCEPT'
  | 'MINOR_REVISION'
  | 'MAJOR_REVISION'
  | 'REJECT';

export interface JournalReview {
  id?: string;
  reviewerId: string;
  reviewerEmail?: string | null;
  recommendation: JournalReviewRecommendation;
  commentsToAuthor: string;
  commentsToEditor?: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  submittedAt?: FirestoreTimestamp;
}

export interface JournalArticle {
  id?: string;
  title: string;
  abstract: string;
  authors: string;
  affiliations?: string[];
  language: 'en' | 'ar' | 'both';
  pdfUrl?: string;
  pdfPath?: string;
  codeUrl?: string;
  keywords?: string[];
  license?: string;
  status: JournalArticleStatus;
  createdBy: string;
  createdByEmail?: string | null;
  createdByName?: string | null;
  reviewerIds?: string[];
  reviewerEmails?: string[];
  issueId: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  acceptedAt?: FirestoreTimestamp | null;
  publishedAt?: FirestoreTimestamp | null;
}

export interface JournalIssue {
  id?: string;
  label: string;
  year?: number | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}
