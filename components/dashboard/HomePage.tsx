import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, arrayUnion, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudyRequest, User, StudyGroup, StudyPost } from '../../types';
import Avatar from '../core/Avatar';
import { UsersIcon, ChatBubbleIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, LightbulbIcon, ClockIcon, RefreshIcon } from '../icons';
import StudySessionModal from './StudySessionModal';
import { getSubjectName } from '../../lib/helpers';
import { ALL_SUBJECTS } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import { sendMessageToPartner } from '../../lib/messaging';

const AnimatedStatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; colorClass: string }> = ({ icon, label, value, colorClass }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (value === 0) {
            setCount(0);
            return;
        }
        const duration = 1000;
        let start = 0;
        const end = value;
        if (start === end) return;

        let startTimestamp: number | null = null;
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            setCount(Math.floor(progress * (end - start) + start));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }, [value]);
    
    return (
        <div className={`p-4 sm:p-6 rounded-xl flex items-center gap-4 ${colorClass}`}>
            <div className="p-3 bg-white/20 rounded-lg">{icon}</div>
            <div>
                <div className="text-3xl sm:text-4xl font-bold">{count}</div>
                <div className="text-sm font-medium uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );
};


const HomePage: React.FC = () => {
    const { currentUser, openStudyModal, isStudyModalOpen, closeStudyModal, incrementStudyTime } = useAuth();
    const navigate = useNavigate();
    const [incomingRequests, setIncomingRequests] = useState<StudyRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [partners, setPartners] = useState<User[]>([]);
    const [loadingPartners, setLoadingPartners] = useState(true);
    const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [funFact, setFunFact] = useState('');
    const [loadingFact, setLoadingFact] = useState(true);
    
    const fetchFunFact = async () => {
        setLoadingFact(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const categories = ['science', 'history', 'nature', 'technology', 'space', 'amazing animals'];
            const randomCategory = categories[Math.floor(Math.random() * categories.length)];
            const prompt = `Tell me a fun, interesting, and short fact about ${randomCategory} suitable for students. Make sure to bold the most interesting part of the fact using double asterisks, like **this**.`;

            const geminiResponse = await ai.models.generateContent({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });
            setFunFact(geminiResponse.text);
        } catch (error) {
            console.error("Error fetching fun fact:", error);
            setFunFact("The first computer mouse was **made of wood**.");
        } finally {
            setLoadingFact(false);
        }
    };
    
    useEffect(() => {
        fetchFunFact();
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
            setPartners([]);
            setLoadingPartners(false);
            return;
        }
        
        const fetchPartners = async () => {
             setLoadingPartners(true);
            if (currentUser.connections.length > 0) {
                 try {
                    const partnerPromises = currentUser.connections.map(uid => getDoc(doc(db, "users", uid)));
                    const partnerDocs = await Promise.all(partnerPromises);
                    const partnerData = partnerDocs
                        .filter(doc => doc.exists())
                        .map(doc => ({uid: doc.id, ...doc.data()}) as User);
                    setPartners(partnerData);
                 } catch (error) {
                    console.error("Error fetching partners: ", error);
                    setPartners([]);
                 }
            } else {
                setPartners([]);
            }
            setLoadingPartners(false);
        };

        fetchPartners();
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

                // Generate and send welcome message
                try {
                    const postDocRef = doc(db, "studyPosts", request.postId);
                    const postSnap = await getDoc(postDocRef);

                    let welcomeMessage = "Hey! I'm looking forward to studying with you!"; // Default message

                    if (postSnap.exists()) {
                        const postData = postSnap.data() as StudyPost;
                        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                        const prompt = `A student accepted my study request about "${postData.description}". Write a short, friendly, and enthusiastic welcome message (around 20-30 words) to send them. Sound excited to start studying together.`;
                        
                        const geminiResponse = await ai.models.generateContent({
                            model: 'gemini-flash-lite-latest',
                            contents: prompt,
                        });
                        
                        if (geminiResponse.text) {
                            welcomeMessage = geminiResponse.text;
                        }
                    }
                    
                    // Send the message
                    await sendMessageToPartner(currentUser.uid, request.fromUserId, { text: welcomeMessage });

                } catch (aiError) {
                    console.error("Error generating or sending AI message, sending default:", aiError);
                    // Fallback to sending the default message if AI fails
                    await sendMessageToPartner(currentUser.uid, request.fromUserId, { text: "Hey! I'm looking forward to studying with you!" });
                }
                
                navigate('/messages', { state: { selectedPartnerId: request.fromUserId } });
            }
        } catch (error) {
            console.error("Error updating request: ", error);
            alert("Failed to update request.");
        }
    };
    
     const handleEndSession = async (durationInSeconds: number) => {
        closeStudyModal();
        if (durationInSeconds > 10) { // Only save sessions longer than 10 seconds
            await incrementStudyTime(Math.round(durationInSeconds));
        }
    };
    
    const renderFunFact = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return (
            <>
                {parts.map((part, index) =>
                    part.startsWith('**') && part.endsWith('**') ? (
                        <strong key={index}>{part.slice(2, -2)}</strong>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };


    return (
        <div className="container mx-auto p-4 sm:p-8 space-y-12">
             <StudySessionModal isOpen={isStudyModalOpen} onClose={handleEndSession} />
             <div className="animate-fadeInDown">
                <h1 className="text-3xl sm:text-4xl font-bold text-onBackground">Activity Hub</h1>
                <p className="mt-2 text-lg text-onSurface">Welcome back, {currentUser?.username}! Here's your study overview.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white mt-6">
                    <AnimatedStatCard icon={<UsersIcon className="w-8 h-8"/>} label="Partners" value={partners.length} colorClass="bg-gradient-to-br from-indigo-500 to-purple-600" />
                    <AnimatedStatCard icon={<UsersIcon className="w-8 h-8"/>} label="Groups" value={myGroups.length} colorClass="bg-gradient-to-br from-teal-500 to-cyan-600" />
                    <button onClick={openStudyModal} className="p-4 sm:p-6 rounded-xl flex items-center gap-4 bg-gradient-to-br from-yellow-400 to-amber-500 transition-transform hover:scale-105 shadow-lg hover:shadow-amber-500/30">
                        <div className="p-3 bg-white/20 rounded-lg"><ClockIcon className="w-8 h-8"/></div>
                        <div>
                            <div className="text-2xl font-bold text-left">Start Studying</div>
                            <div className="text-sm font-medium uppercase tracking-wider text-left">Begin a focus session</div>
                        </div>
                    </button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg">
                    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-onBackground"><UsersIcon/> My Partners</h2>
                    {loadingPartners ? ( <p className="mt-4 text-onSurface">Loading partners...</p> ) : 
                    partners.length > 0 ? (
                        <ul className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                            {partners.map(partner => (
                                <li key={partner.uid} className="flex items-center justify-between p-3 bg-background rounded-lg transition hover:bg-gray-800 border border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <Avatar user={partner} className="w-10 h-10"/>
                                        <span className="font-semibold text-onBackground">{partner.username}</span>
                                    </div>
                                    <Link to="/messages" state={{ selectedPartnerId: partner.uid }} className="text-sm text-primary hover:underline font-semibold">Message</Link>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">No active partners yet. <Link to="/requests" className="text-primary hover:underline">Find a partner</Link> to get started!</p> )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg">
                    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-onBackground"><ChatBubbleIcon/> Pending Requests</h2>
                    {loadingRequests ? ( <p className="mt-4 text-onSurface">Loading requests...</p> ) : 
                    incomingRequests.length > 0 ? (
                        <ul className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                            {incomingRequests.map(req => (
                                <li key={req.id} className="flex items-center justify-between p-2 bg-background rounded-md border border-gray-700">
                                    <span className="text-onSurface">Request from <span className="font-bold text-onBackground">{req.fromUsername}</span></span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRequestResponse(req, 'accepted')} className="p-1 text-green-400 hover:bg-green-500/20 rounded-full transition-all duration-200 transform hover:scale-125" title="Accept"><CheckCircleIcon className="w-6 h-6" /></button>
                                        <button onClick={() => handleRequestResponse(req, 'declined')} className="p-1 text-red-400 hover:bg-red-500/20 rounded-full transition-all duration-200 transform hover:scale-125" title="Decline"><XCircleIcon className="w-6 h-6" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">You have no pending study requests.</p> )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg">
                    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-onBackground"><UsersIcon /> My Groups</h2>
                    {loadingGroups ? <p className="mt-4 text-onSurface">Loading groups...</p> : 
                    myGroups.length > 0 ? (
                        <ul className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                            {myGroups.map(group => (
                                <Link to={`/group/${group.id}`} key={group.id} className="block p-3 bg-background rounded-lg transition hover:bg-gray-800 hover:shadow-md border border-gray-700 hover:border-primary/50">
                                    <h3 className="font-bold text-primary">{group.name}</h3>
                                    <p className="text-sm text-onSurface">{group.subjectName}</p>
                                    <p className="text-xs text-gray-400 mt-1">{group.memberIds.length} members</p>
                                </Link>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-onSurface">You haven't joined any groups yet. <Link to="/groups" className="text-primary hover:underline">Find a group</Link> to collaborate!</p>
                    )}
                </div>
             </div>
             
            {/* Fun Fact Section */}
            <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-500 p-6 sm:p-8 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-6 text-white animate-fadeInUp">
                <div className="p-4 bg-white/20 rounded-full flex-shrink-0">
                    <LightbulbIcon className="w-12 h-12 text-yellow-300"/>
                </div>
                <div className="flex-grow text-center md:text-left">
                    <h2 className="text-2xl font-bold mb-2">Did You Know?</h2>
                    <p className="text-lg">
                        {loadingFact ? 'Thinking of something cool...' : renderFunFact(funFact)}
                    </p>
                </div>
                <button 
                    onClick={fetchFunFact} 
                    disabled={loadingFact} 
                    className="p-3 bg-white/20 rounded-full transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 flex-shrink-0"
                    aria-label="Get another fun fact"
                >
                    <RefreshIcon className={`w-6 h-6 ${loadingFact ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>
    );
};

export default HomePage;