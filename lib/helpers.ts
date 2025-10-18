import { StudentProfile, LearningStyle, StudyGroup, Subject } from '../types';
import { ALL_SUBJECTS } from '../constants';

export const sanitizeProfile = (data: any, userId: string): StudentProfile => ({
    userId: data.userId || userId,
    bio: data.bio || '',
    learningStyle: data.learningStyle || LearningStyle.Visual,
    preferredMethods: data.preferredMethods || [],
    availability: data.availability || [],
    badges: data.badges || [],
    quizWins: data.quizWins || 0,
    totalStudyTime: data.totalStudyTime || 0,
});

export const sanitizeGroup = (data: any, id: string): StudyGroup => ({
    id: data.id || id,
    name: data.name || 'Unnamed Group',
    description: data.description || '',
    creatorId: data.creatorId || '',
    subjectId: data.subjectId || 0,
    subjectName: data.subjectName || 'Unknown',
    memberIds: data.memberIds || [],
    scheduledSession: data.scheduledSession || null,
});

export const getSubjectName = (id: number): string => ALL_SUBJECTS.find(s => s.id === id)?.name || 'Unknown';

export const formatDuration = (totalSeconds: number): string => {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    if (totalSeconds < 60) {
        return `${Math.floor(totalSeconds)}s`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let result = '';
    if (hours > 0) {
        result += `${hours}h `;
    }
    result += `${minutes}m`;
    return result.trim();
};