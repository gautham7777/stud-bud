import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import Avatar from '../core/Avatar';
import { PaperClipIcon } from '../icons';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const AIMockInterviewer: React.FC = () => {
    const { currentUser } = useAuth();
    const [topic, setTopic] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const startInterview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        
        setIsLoading(true);
        setMessages([]);

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const newChat = ai.chats.create({
            model: 'gemini-flash-lite-latest',
            config: {
                systemInstruction: `You are a friendly but professional mock interviewer. The interview is for a student position related to "${topic}". Start by greeting the user and asking the first question. Ask only one question at a time. After the user responds, provide brief, constructive feedback on their answer, and then ask the next relevant question. Keep the interview flowing naturally.`
            }
        });
        setChat(newChat);
        
        setMessages([{ role: 'model', text: '' }]);
        const responseStream = await newChat.sendMessageStream({ message: "Start the interview." });
        setIsLoading(false);
        
        for await (const chunk of responseStream) {
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text += chunk.text;
                return newMessages;
            });
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !chat) return;

        const text = userInput.trim();
        setUserInput('');
        setMessages(prev => [...prev, { role: 'user', text }]);
        setIsLoading(true);

        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        const responseStream = await chat.sendMessageStream({ message: text });
        setIsLoading(false);

        for await (const chunk of responseStream) {
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text += chunk.text;
                return newMessages;
            });
        }
    };

    if (!chat) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-onSurface mb-4">What role or topic are you interviewing for?</p>
                <form onSubmit={startInterview} className="flex flex-col sm:flex-row items-center gap-4">
                    <input
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g., Software Engineering Intern, Marketing"
                        className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button type="submit" disabled={isLoading || !topic.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-lg hover:from-blue-500 hover:to-blue-400 transition transform active:scale-95 disabled:opacity-50">
                        {isLoading ? 'Starting...' : 'Start Interview'}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && <Avatar user={{uid: 'ai', email:'', username:'AI'}} className="w-8 h-8 flex-shrink-0" />}
                        <div className={`max-w-md rounded-lg p-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface text-onSurface'}`}>
                            {msg.text}
                        </div>
                        {msg.role === 'user' && <Avatar user={currentUser} className="w-8 h-8 flex-shrink-0" />}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3 justify-start">
                        <Avatar user={{uid: 'ai', email:'', username:'AI'}} className="w-8 h-8 flex-shrink-0" />
                        <div className="max-w-md rounded-lg p-3 text-sm bg-surface text-onSurface animate-pulse">
                            Typing...
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex-shrink-0 flex gap-2 items-center p-4 border-t border-gray-700">
                <input
                    type="text"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    placeholder="Your answer..."
                    className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-surface text-onBackground"
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !userInput.trim()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition disabled:opacity-50">
                    Send
                </button>
            </form>
        </div>
    );
};

export default AIMockInterviewer;