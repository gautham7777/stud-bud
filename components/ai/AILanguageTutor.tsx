import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import Avatar from '../core/Avatar';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const LANGUAGES = ["Spanish", "French", "German", "Italian", "Japanese", "Mandarin"];

const AILanguageTutor: React.FC = () => {
    const { currentUser } = useAuth();
    const [language, setLanguage] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const startTutorSession = async () => {
        if (!language) return;
        
        setIsLoading(true);
        setMessages([]);

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const newChat = ai.chats.create({
            model: 'gemini-flash-lite-latest',
            config: {
                systemInstruction: `You are a friendly and patient language tutor for ${language}. Your goal is to help the user practice speaking in ${language}. Greet them in ${language} and start a simple conversation. When the user responds, gently correct any mistakes they make and suggest a better way to phrase it, then continue the conversation. Keep your responses concise.`
            }
        });
        setChat(newChat);

        setMessages([{ role: 'model', text: '' }]);
        const responseStream = await newChat.sendMessageStream({ message: `Start the conversation in ${language}.` });
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
                <p className="text-onSurface mb-4">What language would you like to practice?</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {LANGUAGES.map(lang => (
                        <button 
                            key={lang}
                            onClick={() => { setLanguage(lang); }}
                            className={`p-4 rounded-lg border-2 transition-all ${language === lang ? 'border-yellow-500 bg-yellow-500/20 scale-105' : 'border-gray-600 bg-surface hover:bg-gray-700'}`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
                <button onClick={startTutorSession} disabled={isLoading || !language} className="mt-6 w-full max-w-xs px-6 py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-semibold rounded-lg hover:from-yellow-500 hover:to-yellow-400 transition transform active:scale-95 disabled:opacity-50">
                    {isLoading ? 'Starting...' : 'Start Practice'}
                </button>
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
                            ...
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
                    placeholder={`Type in ${language}...`}
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

export default AILanguageTutor;