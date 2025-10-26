import React, { useState, useEffect, useRef } from 'react';
import { ALL_SUBJECTS } from '../../constants';
import { getSubjectName } from '../../lib/helpers';
import { GoogleGenAI } from "@google/genai";
import { AIResponse } from './common';


const AITutor: React.FC<{ initialQuery?: string | null }> = ({ initialQuery }) => {
    const [query, setQuery] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [answer, setAnswer] = useState('');
    const [isAnswering, setIsAnswering] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialQuery) {
            setQuery(initialQuery);
        }
    }, [initialQuery]);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAskTutor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !selectedSubjectId) return;
        setIsAnswering(true);
        setAnswer('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const subjectName = getSubjectName(selectedSubjectId);
            const prompt = `You are an expert tutor for ${subjectName}. The student has the following request: "${query}". Please provide a clear, helpful, and encouraging response. Explain concepts, answer questions, or provide practice problems as needed. Use markdown for formatting.`;
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });

            let streamedText = "";
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setAnswer(streamedText);
            }
        } catch (error) {
            console.error("Error with AI Tutor:", error);
            setAnswer("Sorry, I couldn't find an answer right now. Please try rephrasing or ask again later.");
        } finally {
            setIsAnswering(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleAskTutor}>
                <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question, request an explanation (e.g., 'Explain mitosis'), or ask for practice problems (e.g., 'Give me 3 practice problems on quadratic equations')..."
                    className="w-full p-3 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-secondary focus:border-secondary"
                    rows={4}
                />
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                     <div className="relative w-full sm:w-auto flex-grow" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full text-left p-2 border border-gray-600 rounded-lg focus:ring-secondary focus:border-secondary bg-surface text-onBackground flex justify-between items-center"
                        >
                            <span>{selectedSubjectId ? getSubjectName(selectedSubjectId) : 'Select a subject...'}</span>
                            <svg className={`w-5 h-5 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 animate-fadeInDown max-h-60 overflow-y-auto">
                                {ALL_SUBJECTS.map(subject => (
                                    <div
                                        key={subject.id}
                                        onClick={() => { setSelectedSubjectId(subject.id); setIsDropdownOpen(false); }}
                                        className="p-3 hover:bg-secondary/20 cursor-pointer text-onSurface"
                                    >
                                        {subject.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="submit" disabled={isAnswering || !query.trim() || !selectedSubjectId} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-secondary to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition transform active:scale-95 disabled:opacity-50">
                        {isAnswering ? 'Thinking...' : 'Get Help'}
                    </button>
                </div>
            </form>

            <AIResponse response={answer} isAnswering={isAnswering} thinkingText="AI is thinking..." />
        </div>
    );
};

export default AITutor;
