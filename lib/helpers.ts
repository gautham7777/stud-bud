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

export const formatAIResponse = (text: string): string => {
    // Process markdown-like syntax
    let sections = text.split('```');
    let html = sections.map((section, index) => {
        if (index % 2 === 1) {
            // This is a code block
            const codeContent = section.replace(/^\s*(\w+)?\n/, ''); // remove language hint
            return `<pre><code class="bg-gray-900 rounded p-4 block overflow-x-auto font-mono text-sm">${codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        } else {
            // This is regular text
            return section
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="bg-gray-700 rounded px-1 py-0.5 font-mono text-sm">$1</code>')
                .replace(/^(#{1,3}) (.*)/gm, (match, hashes, content) => {
                    const level = hashes.length;
                    return `<h${level + 2} class="font-bold mt-4 mb-2 text-onBackground">${content}</h${level + 2}>`;
                })
                .replace(/^- (.*)/gm, '<li class="ml-5 list-disc">$1</li>')
                .replace(/^\d+\. (.*)/gm, '<li class="ml-5 list-decimal">$1</li>')
                .replace(/\n/g, '<br />');
        }
    }).join('');

    // Wrap list items in <ul> or <ol> tags
    html = html.replace(/(<li class="ml-5 list-disc">.*?<\/li>)(?![^<]*<li)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul><br \/><ul>/g, ''); 
    html = html.replace(/(<li class="ml-5 list-decimal">.*?<\/li>)(?![^<]*<li)/gs, '<ol>$1</ol>');
    html = html.replace(/<\/ol><br \/><ol>/g, '');

    return html;
};
