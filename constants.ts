import { Subject, LearningStyle, StudyMethod } from './types';

export const ALL_SUBJECTS: Subject[] = [
  { id: 1, name: 'Mathematics' },
  { id: 2, name: 'Physics' },
  { id: 3, name: 'World History' },
  { id: 4, name: 'Chemistry' },
  { id: 5, name: 'Computer Science' },
  { id: 6, name: 'Literature' },
  { id: 7, name: 'Biology' },
  { id: 8, name: 'Art History' },
];

export const ALL_AVAILABILITY_OPTIONS: string[] = [
  'Mornings',
  'Afternoons',
  'Evenings',
  'Weekends',
  'Weekdays',
];

export const ALL_LEARNING_STYLES: { style: LearningStyle, description: string }[] = [
    { style: LearningStyle.Visual, description: "Learns best by seeing information (diagrams, charts, videos)." },
    { style: LearningStyle.Auditory, description: "Learns best through listening (lectures, discussions, podcasts)." },
    { style: LearningStyle.Kinesthetic, description: "Learns best by doing and hands-on activities." },
];

export const ALL_STUDY_METHODS = Object.values(StudyMethod);
