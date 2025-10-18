export enum LearningStyle {
  Visual = 'Visual',
  Auditory = 'Auditory',
  Kinesthetic = 'Kinesthetic',
}

export enum StudyMethod {
  Discussion = 'Discussion-based',
  ProblemSolving = 'Problem-solving',
  QuietReview = 'Quiet review',
  Flashcards = 'Flashcards',
}

export interface User {
  uid: string;
  email: string;
  username:string;
  photoURL?: string;
  connections?: string[]; // Array of user UIDs
}

export interface StudentProfile {
  userId: string;
  bio: string;
  learningStyle: LearningStyle;
  preferredMethods: StudyMethod[];
  availability: string[];
  badges?: string[];
  quizWins?: number;
  totalStudyTime?: number; // in seconds
}

export interface Subject {
  id: number;
  name: string;
}

export interface ScheduledSession {
  topic: string;
  scheduledAt: number; // timestamp
  scheduledBy: string; // username
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  subjectId: number;
  subjectName: string;
  memberIds: string[];
  scheduledSession?: ScheduledSession | null;
}

export interface Message {
  id: string;
  senderId: string;
  conversationId: string; // e.g., "user-uid1-user-uid2" or "group-id"
  text?: string;
  imageUrl?: string;
  timestamp: number;
  // For displaying in chat without extra lookups
  senderUsername?: string; 
  senderPhotoURL?: string;
}

export interface SharedContent {
  groupId: string;
  scratchpad: string;
  whiteboardData: any; // Store drawing paths, etc.
}

export interface StudyRequest {
  id:string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  postId: string;
}

export interface StudyPost {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorPhotoURL?: string;
  subjectIds: number[];
  description: string;
  createdAt: number;
}

export interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Quiz {
  id: string;
  groupId: string;
  subjectName: string;
  questions: Question[];
  createdBy: string;
  createdAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  username: string;
  score: number; // e.g., number of correct answers
  totalQuestions: number;
  completedAt: number;
}

export interface StudyMaterial {
  id: string;
  userId: string;
  imageUrl: string;
  description: string;
  uploadedAt: number;
}

export interface UserMark {
  id: string;
  userId: string;
  subjectId: number;
  subjectName: string;
  marks: string;
  createdAt: number;
}

export interface DiscoverPost {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorPhotoURL?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image';
  likes: string[]; // Array of user UIDs who liked the post
  commentCount: number;
  createdAt: number;
}

export interface DiscoverComment {
  id:string;
  postId: string;
  creatorId: string;
  // FIX: Corrected the type for 'creatorUsername' from the invalid 'aistudio' to 'string'.
  creatorUsername: string;
  creatorPhotoURL?: string;
  text: string;
  createdAt: number;
}