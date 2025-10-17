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
  username: string;
  photoURL?: string;
  connections?: string[]; // Array of user UIDs
}

export interface StudentProfile {
  userId: string;
  bio: string;
  learningStyle: LearningStyle;
  preferredMethods: StudyMethod[];
  availability: string[];
  subjectsNeedHelp: number[]; // Array of subject IDs
  subjectsCanHelp: number[]; // Array of subject IDs
  badges?: string[];
}

export interface Subject {
  id: number;
  name: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  subjectId: number;
  subjectName: string;
  memberIds: string[];
}

export interface Message {
  id: string;
  senderId: string;
  conversationId: string; // e.g., "user-uid1-user-uid2" or "group-id"
  text: string;
  timestamp: number;
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
}