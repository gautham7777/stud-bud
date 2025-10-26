import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AIResponse } from './common';

const AISummarizer: React.FC = () => {
    const [text, setText] = useState('');
    const [summary, setSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);

    const handleSummarize = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        setIsSummarizing(true);
        setSummary('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Summarize the following text concisely:\n\n${text}`;
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });

            let streamedText = "";
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setSummary(streamedText);
            }
        } catch (error) {
            console.error("Error with AI Summarizer:", error);
            setSummary("Sorry, I couldn't summarize the text. Please try again later.");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSummarize}>
                <textarea 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your text here to summarize..."
                    className="w-full p-3 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-amber-500 focus:border-amber-500"
                    rows={10}
                />
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={isSummarizing || !text.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-semibold rounded-lg hover:from-amber-500 hover:to-amber-400 transition transform active:scale-95 disabled:opacity-50">
                        {isSummarizing ? 'Summarizing...' : 'Summarize'}
                    </button>
                </div>
            </form>

            <AIResponse response={summary} isAnswering={isSummarizing} thinkingText="AI is summarizing the text..." />
        </div>
    );
};

export default AISummarizer;