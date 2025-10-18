
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, arrayUnion, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudyRequest, User, StudyGroup } from '../../types';
import Avatar from '../core/Avatar';
import { UsersIcon, ChatBubbleIcon, CheckCircleIcon, XCircleIcon, SparklesIcon } from '../icons';
import { getSubjectName } from '../../lib/helpers';
import { ALL_SUBJECTS } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import { sendMessageToBuddy } from '../../lib/messaging';

const HomePage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [incomingRequests, setIncomingRequests] = useState<StudyRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [buddies, setBuddies] = useState<User[]>([]);
    const [loadingBuddies, setLoadingBuddies] = useState(true);
    const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);

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
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "studyRequests"), 
            where("toUserId", "==", currentUser.uid), 
            where("status", "==", "pending")
        );
        const unsubscribeRequests = onSnapshot(q, (querySnapshot) => {
            const requests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRequest));
            setIncomingRequests(requests);
            setLoadingRequests(false);
        });

        const groupsQuery = query(collection(db, "studyGroups"), where("memberIds", "array-contains", currentUser.uid));
        const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
            const groups = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() } as StudyGroup));
            setMyGroups(groups);
            setLoadingGroups(false);
        });
        
        return () => {
            unsubscribeRequests();
            unsubscribeGroups();
        };
    }, [currentUser]);
    
    useEffect(() => {
        if (!currentUser?.connections) {
            setBuddies([]);
            setLoadingBuddies(false);
            return;
        }
        
        const fetchBuddies = async () => {
             setLoadingBuddies(true);
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
            setLoadingBuddies(false);
        };

        fetchBuddies();
    }, [currentUser?.connections]);

    const handleRequestResponse = async (request: StudyRequest, newStatus: 'accepted' | 'declined') => {
        if (!currentUser) return;
        try {
            const requestDocRef = doc(db, "studyRequests", request.id);
            await updateDoc(requestDocRef, { status: newStatus });

            if (newStatus === 'accepted') {
                const batch = writeBatch(db);

                const currentUserRef = doc(db, "users", currentUser.uid);
                const otherUserRef = doc(db, "users", request.fromUserId);
                batch.update(currentUserRef, { connections: arrayUnion(request.fromUserId) });
                batch.update(otherUserRef, { connections: arrayUnion(currentUser.uid) });

                if (request.postId) {
                    const postDocRef = doc(db, "studyPosts", request.postId);
                    batch.delete(postDocRef);

                    // Decline other requests for the same post
                    const otherRequestsQuery = query(collection(db, "studyRequests"), where("postId", "==", request.postId), where("status", "==", "pending"));
                    const otherRequestsSnapshot = await getDocs(otherRequestsQuery);
                    otherRequestsSnapshot.forEach(doc => {
                        if (doc.id !== request.id) {
                            batch.update(doc.ref, { status: 'declined' });
                        }
                    });
                }
                
                await batch.commit();
                navigate('/messages', { state: { selectedBuddyId: request.fromUserId } });

            }
        } catch (error) {
            console.error("Error updating request: ", error);
            alert("Failed to update request.");
        }
    };

    const handleGeneratePlan = async () => {
        if (!selectedSubjectId) return;
        setIsGeneratingPlan(true);
        setStudyPlan(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const subjectName = getSubjectName(selectedSubjectId);
            const prompt = `Create a concise, one-week study plan for the subject "${subjectName}". Break it down into daily tasks. The plan should be encouraging and easy to follow. Use markdown for formatting with headings for each day.`;
            const geminiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            setStudyPlan(geminiResponse.text);
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
        <div className="container mx-auto p-8">
             <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-onBackground">Dashboard</h1>
                    <p className="mt-2 text-lg text-onSurface">Here's your study overview.</p>
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg lg:col-span-2">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-onBackground"><UsersIcon/> My Buddies</h2>
                    {loadingBuddies ? ( <p className="mt-4 text-onSurface">Loading buddies...</p> ) : 
                    buddies.length > 0 ? (
                        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {buddies.map(buddy => (
                                <li key={buddy.uid} className="flex items-center justify-between p-3 bg-background rounded-lg transition hover:bg-gray-800 border border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <Avatar user={buddy} className="w-10 h-10"/>
                                        <span className="font-semibold text-onBackground">{buddy.username}</span>
                                    </div>
                                    <ReactRouterDOM.Link to="/messages" state={{ selectedBuddyId: buddy.uid }} className="text-sm text-primary hover:underline font-semibold">Message</ReactRouterDOM.Link>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">No active buddies yet. <ReactRouterDOM.Link to="/requests" className="text-primary hover:underline">Find a partner</ReactRouterDOM.Link> to get started!</p> )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg lg:col-span-1">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-onBackground"><ChatBubbleIcon/> Pending Requests</h2>
                    {loadingRequests ? ( <p className="mt-4 text-onSurface">Loading requests...</p> ) : 
                    incomingRequests.length > 0 ? (
                        <ul className="mt-4 space-y-3">
                            {incomingRequests.map(req => (
                                <li key={req.id} className="flex items-center justify-between p-2 bg-background rounded-md border border-gray-700">
                                    <span className="text-onSurface">Request from <span className="font-bold text-onBackground">{req.fromUsername}</span></span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRequestResponse(req, 'accepted')} className="p-1 text-green-400 hover:bg-green-500/20 rounded-full transition-all duration-[195ms] transform hover:scale-125" title="Accept"><CheckCircleIcon className="w-6 h-6" /></button>
                                        <button onClick={() => handleRequestResponse(req, 'declined')} className="p-1 text-red-400 hover:bg-red-500/20 rounded-full transition-all duration-[195ms] transform hover:scale-125" title="Decline"><XCircleIcon className="w-6 h-6" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">You have no pending study requests.</p> )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg lg:col-span-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-onBackground"><UsersIcon /> My Groups</h2>
                    {loadingGroups ? <p className="mt-4 text-onSurface">Loading groups...</p> : 
                    myGroups.length > 0 ? (
                        <ul className={`mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${myGroups.length > 6 ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                            {myGroups.map(group => (
                                <ReactRouterDOM.Link to={`/group/${group.id}`} key={group.id} className="block p-4 bg-background rounded-lg transition hover:bg-gray-800 hover:shadow-md border border-gray-700 hover:border-primary/50">
                                    <h3 className="font-bold text-primary">{group.name}</h3>
                                    <p className="text-sm text-onSurface">{group.subjectName}</p>
                                    <p className="text-xs text-gray-400 mt-2">{group.memberIds.length} members</p>
                                </ReactRouterDOM.Link>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-onSurface">You haven't joined any groups yet. <ReactRouterDOM.Link to="/groups" className="text-primary hover:underline">Find a group</ReactRouterDOM.Link> to collaborate!</p>
                    )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg lg:col-span-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-primary"><SparklesIcon /> AI Study Planner</h2>
                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full sm:w-auto flex-grow" ref={planDropdownRef}>
                            <button
                                onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                                className="w-full text-left p-2 border border-gray-600 rounded-lg focus:ring-primary focus:border-primary bg-surface text-onBackground flex justify-between items-center"
                            >
                                <span>{selectedSubjectId ? getSubjectName(selectedSubjectId) : 'Select a subject...'}</span>
                                <svg className={`w-5 h-5 transform transition-transform ${isPlanDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                            {isPlanDropdownOpen && (
                                <div className="absolute bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 animate-fadeInDown max-h-60 overflow-y-auto">
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

                    {isGeneratingPlan && <div className="mt-4 text-center text-onSurface">Generating your study plan...</div>}

                    {studyPlan && (
                        <div className="mt-6 p-4 bg-indigo-500/10 rounded-lg animate-fadeInUp border border-indigo-500/30">
                            <h3 className="text-lg font-bold mb-2 text-onBackground">Your {getSubjectName(selectedSubjectId!)} Study Plan:</h3>
                            <div className="whitespace-pre-wrap text-onSurface prose prose-invert" dangerouslySetInnerHTML={{ __html: studyPlan.replace(/\n/g, '<br />') }} />
                            
                            {buddies.length > 0 && (
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
                                                <div className="absolute bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 animate-fadeInDown max-h-40 overflow-y-auto">
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
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};

export default HomePage;