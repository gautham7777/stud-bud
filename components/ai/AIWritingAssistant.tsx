import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AIResponse } from './common';

type Action = 'improve' | 'rephrase' | 'fix_grammar';

const AIWritingAssistant: React.FC = () => {
    const [text, setText] = useState('');
    const [result, setResult] = useState('');
    const [isWorking, setIsWorking] = useState(false);
    const [currentAction, setCurrentAction] = useState<Action | null>(null);

    const handleAction = async (action: Action) => {
        if (!text.trim()) return;
        setIsWorking(true);
        setResult('');
        setCurrentAction(action);

        const actionPrompts: Record<Action, string> = {
            improve: `Improve the clarity and flow of the following text:\n\n${text}`,
            rephrase: `Rephrase the following text to sound more academic and formal:\n\n${text}`,
            fix_grammar: `Fix any spelling and grammar mistakes in the following text and provide the corrected version:\n\n${text}`
        };

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = actionPrompts[action];
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });

            let streamedText = "";
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setResult(streamedText);
            }
        } catch (error) {
            console.error(`Error with AI Writing Assistant (${action}):`, error);
            setResult("Sorry, I encountered an error. Please try again.");
        } finally {
            setIsWorking(false);
            setCurrentAction(null);
        }
    };

    const ActionButton: React.FC<{ action: Action, label: string, color: string }> = ({ action, label, color }) => (
        <button 
            onClick={() => handleAction(action)} 
            disabled={isWorking || !text.trim()} 
            className={`w-full sm:w-auto px-6 py-2 bg-gradient-to-r ${color} text-white font-semibold rounded-lg transition transform active:scale-95 disabled:opacity-50`}
        >
            {isWorking && currentAction === action ? 'Working...' : label}
        </button>
    );

    return (
        <div>
            <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here for assistance..."
                className="w-full p-3 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-lime-500 focus:border-lime-500"
                rows={10}
            />
            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-4">
                <ActionButton action="fix_grammar" label="Fix Grammar" color="from-rose-600 to-danger" />
                <ActionButton action="rephrase" label="Rephrase" color="from-sky-600 to-blue-500" />
                <ActionButton action="improve" label="Improve" color="from-lime-600 to-lime-500" />
            </div>

            <AIResponse response={result} isAnswering={isWorking} thinkingText="AI is working its magic..." />
        </div>
    );
};

export default AIWritingAssistant;