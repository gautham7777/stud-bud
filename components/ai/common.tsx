import React from 'react';
import { formatAIResponse } from '../../lib/helpers';

interface AIResponseProps {
    response: string | null;
    isAnswering: boolean;
    thinkingText: string;
    children?: React.ReactNode;
}

export const AIResponse: React.FC<AIResponseProps> = ({ response, isAnswering, thinkingText, children }) => {
    if (isAnswering) {
        return <div className="mt-4 text-center text-onSurface">{thinkingText}</div>;
    }
    if (response) {
        return (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg animate-fadeInUp border border-gray-700">
                <div className="text-onSurface prose prose-invert max-w-none prose-p:text-onSurface prose-strong:text-onBackground" dangerouslySetInnerHTML={{ __html: formatAIResponse(response) }} />
                {children}
            </div>
        );
    }
    return null;
};
