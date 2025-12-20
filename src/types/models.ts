import type { FieldValue, Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp | FieldValue | null;
export type UserRole = 'student' | 'teacher' | 'editor' | 'admin';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LivePlatform = 'jitsi' | 'google-meet' | 'none';

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
  title: string;
  description: string;
  category: string;
  price: string;
  duration: string;
  level: CourseLevel;
  imageId: string;
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
