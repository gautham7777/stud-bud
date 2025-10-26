import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../../firebase';
import { getDoc, doc } from 'firebase/firestore';
import { ALL_SUBJECTS } from '../../constants';
import { getSubjectName } from '../../lib/helpers';
import { User } from '../../types';
import { GoogleGenAI } from "@google/genai";
import { sendMessageToBuddy } from '../../lib/messaging';
import { AIResponse } from './common';

const StudyPlanner: React.FC = () => {
    const { currentUser } = useAuth();
    const [buddies, setBuddies] = useState<User[]>([]);

    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [studyPlan, setStudyPlan] = useState<string | null>(null);
    const [selectedBuddyToSend, setSelectedBuddyToSend] = useState<string>('');
    const [sendSuccessMessage, setSendSuccessMessage] = useState('');
    const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
    const [isBuddyDropdownOpen, setIsBuddyDropdownOpen] = useState(false);
    const planDropdownRef = useRef<HTMLDivElement>(null);
    const buddyDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (planDropdownRef.current && !planDropdownRef.current.contains(event.target as Node)) {
                setIsPlanDropdownOpen(false);
            }
            if (buddyDropdownRef.current && !buddyDropdownRef.current.contains(event.target as Node)) {
                setIsBuddyDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!currentUser?.connections || currentUser.connections.length === 0) {
            setBuddies([]);
            return;
        }
        
        const fetchBuddies = async () => {
             if (currentUser.connections.length > 0) {
                 try {
                    const buddyPromises = currentUser.connections.map(uid => getDoc(doc(db, "users", uid)));
                    const buddyDocs = await Promise.all(buddyPromises);
                    const buddyData = buddyDocs
                        .filter(doc => doc.exists())
                        .map(doc => ({uid: doc.id, ...doc.data()}) as User);
                    setBuddies(buddyData);
                    if(buddyData.length > 0) {
                        setSelectedBuddyToSend(buddyData[0].uid);
                    }
                 } catch (error) {
                    console.error("Error fetching buddies: ", error);
                    setBuddies([]);
                 }
            } else {
                setBuddies([]);
            }
        };

        fetchBuddies();
    }, [currentUser?.connections]);

    const handleGeneratePlan = async () => {
        if (!selectedSubjectId) return;
        setIsGeneratingPlan(true);
        setStudyPlan('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const subjectName = getSubjectName(selectedSubjectId);
            const prompt = `Create a concise, one-week study plan for the subject "${subjectName}". Break it down into daily tasks. The plan should be encouraging and easy to follow. Use markdown for formatting with headings for each day.`;
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });

            let streamedText = "";
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setStudyPlan(streamedText);
            }
        } catch (error) {
            console.error("Error generating study plan:", error);
            setStudyPlan("Sorry, I couldn't generate a plan right now. Please try again later.");
        } finally {
            setIsGeneratingPlan(false);
        }
    };
    
    const handleSendPlan = async () => {
        if (!studyPlan || !selectedBuddyToSend || !currentUser) return;
        
        const subjectName = getSubjectName(selectedSubjectId!);
        const planToSend = `Hey! Here's a study plan I generated for ${subjectName}:\n\n${studyPlan}`;

        await sendMessageToBuddy(currentUser.uid, selectedBuddyToSend, { text: planToSend });
        setSendSuccessMessage(`Plan sent to ${buddies.find(b => b.uid === selectedBuddyToSend)?.username}!`);
        setTimeout(() => setSendSuccessMessage(''), 3000);
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:w-auto flex-grow" ref={planDropdownRef}>
                    <button
                        onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                        className="w-full text-left p-2 border border-gray-600 rounded-lg focus:ring-primary focus:border-primary bg-surface text-onBackground flex justify-between items-center"
                    >
                        <span>{selectedSubjectId ? getSubjectName(selectedSubjectId) : 'Select a subject...'}</span>
                        <svg className={`w-5 h-5 transform transition-transform ${isPlanDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                    {isPlanDropdownOpen && (
                        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 animate-fadeInDown max-h-60 overflow-y-auto">
                            {ALL_SUBJECTS.map(subject => (
                                <div
                                    key={subject.id}
                                    onClick={() => {
                                        setSelectedSubjectId(subject.id);
                                        setIsPlanDropdownOpen(false);
                                    }}
                                    className="p-3 hover:bg-primary/20 cursor-pointer text-onSurface"
                                >
                                    {subject.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={handleGeneratePlan} disabled={!selectedSubjectId || isGeneratingPlan} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform active:scale-95 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/30">
                    {isGeneratingPlan ? 'Generating...' : 'Generate Plan'}
                </button>
            </div>

            <AIResponse response={studyPlan} isAnswering={isGeneratingPlan} thinkingText="Generating your study plan..." >
                {studyPlan && buddies.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-indigo-500/30">
                            <h4 className="font-semibold text-onBackground">Share with a buddy:</h4>
                            <div className="mt-2 flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative w-full sm:w-auto flex-grow" ref={buddyDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsBuddyDropdownOpen(!isBuddyDropdownOpen)}
                                        className="w-full text-left p-2 border border-gray-600 rounded-lg focus:ring-primary focus:border-primary bg-surface text-onBackground flex justify-between items-center"
                                    >
                                        <span>{buddies.find(b => b.uid === selectedBuddyToSend)?.username || 'Select a buddy...'}</span>
                                        <svg className={`w-5 h-5 transform transition-transform ${isBuddyDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                    {isBuddyDropdownOpen && (
                                        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 animate-fadeInDown max-h-40 overflow-y-auto">
                                            {buddies.map(buddy => (
                                                <div
                                                    key={buddy.uid}
                                                    onClick={() => {
                                                        setSelectedBuddyToSend(buddy.uid);
                                                        setIsBuddyDropdownOpen(false);
                                                    }}
                                                    className="p-3 hover:bg-primary/20 cursor-pointer text-onSurface"
                                                >
                                                    {buddy.username}
                                                </div>
                                            ))}
                                                {buddies.length === 0 && <div className="p-3 text-onSurface text-sm">No buddies available.</div>}
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleSendPlan} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition transform active:scale-95 shadow-lg hover:shadow-secondary/30">
                                    Send to Buddy
                                </button>
                            </div>
                            {sendSuccessMessage && <p className="mt-2 text-sm text-green-400 animate-fadeInUp">{sendSuccessMessage}</p>}
                        </div>
                    )}
            </AIResponse>
        </div>
    );
};

export default StudyPlanner;