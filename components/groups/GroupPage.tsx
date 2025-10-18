import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { doc, onSnapshot, getDoc, updateDoc, collection, query, orderBy, addDoc, writeBatch, getDocs, arrayRemove, arrayUnion, setDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { StudyGroup, User, SharedContent, Message, ScheduledSession } from '../../types';
import { sanitizeGroup } from '../../lib/helpers';
import LoadingSpinner from '../core/LoadingSpinner';
import Avatar from '../core/Avatar';
import Whiteboard from '../Whiteboard';
import QuizComponent from './QuizComponent';
import ScheduleSessionModal from './ScheduleSessionModal';
import { PencilIcon, CheckCircleIcon, XCircleIcon, UsersIcon, ChevronDownIcon, PlusCircleIcon, TrashIcon, PaperClipIcon, CalendarIcon } from '../icons';
import { isMessageInappropriate } from '../../lib/moderation';
import Modal from '../core/Modal';


const GroupPage: React.FC = () => {
    const { id } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [group, setGroup] = useState<StudyGroup | null>(null);
    const [members, setMembers] = useState<User[]>([]);
    const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);
    const [loading, setLoading] = useState(true);
    const scratchpadUpdateTimeout = useRef<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [isMembersListVisible, setIsMembersListVisible] = useState(false);
    const [isInviteDropdownOpen, setIsInviteDropdownOpen] = useState(false);
    const [buddies, setBuddies] = useState<User[]>([]);
    const [loadingBuddies, setLoadingBuddies] = useState(true);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [viewedImageUrl, setViewedImageUrl] = useState<string | null>(null);

    if (!id) {
        return <div className="container mx-auto p-8 animate-fadeInUp text-center"><h1 className="text-2xl">Group Not Found</h1><p>The link may be broken or the group may have been deleted.</p></div>;
    }

    const contentDocRef = useMemo(() => doc(db, "studyGroups", id, "content", "shared"), [id]);
    const groupDocRef = useMemo(() => doc(db, "studyGroups", id), [id]);
    
    useEffect(() => {
        setLoading(true);
        let groupLoaded = false;
        let contentLoaded = false;

        const checkDone = () => {
            if (groupLoaded && contentLoaded) {
                setLoading(false);
            }
        };

        const unsubGroup = onSnapshot(groupDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const groupData = sanitizeGroup(docSnap.data(), docSnap.id);
                setGroup(groupData);
            } else {
                setGroup(null);
            }
            groupLoaded = true;
            checkDone();
        });
        
        const unsubContent = onSnapshot(contentDocRef, (docSnap) => {
            if(docSnap.exists()){
                setSharedContent(docSnap.data() as SharedContent);
            } else {
                // Create it if it doesn't exist
                const initialContent: SharedContent = { groupId: id, scratchpad: "## Shared Notes\n\n- Let's start!", whiteboardData: []};
                setDoc(contentDocRef, initialContent);
                setSharedContent(initialContent);
            }
            contentLoaded = true;
            checkDone();
        });
        
        const messagesQuery = query(collection(db, "studyGroups", id, "messages"), orderBy("timestamp", "asc"));
        const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(fetchedMessages);
        });

        return () => {
            unsubGroup();
            unsubContent();
            unsubMessages();
        };
    }, [id, contentDocRef, groupDocRef]);
    
    useEffect(() => {
        if (!group) return;
        const fetchMembers = async () => {
            const memberPromises = group.memberIds.map(uid => getDoc(doc(db, "users", uid)));
            const memberDocs = await Promise.all(memberPromises);
            const memberData = memberDocs
                .filter(d => d.exists())
                .map(d => ({uid: d.id, ...d.data()}) as User);
            setMembers(memberData);
        };
        fetchMembers();
    }, [group]);

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
                        .map(doc => ({ uid: doc.id, ...doc.data() }) as User);
                    setBuddies(buddyData);
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    const handleScratchpadChange = (newText: string) => {
        if (!sharedContent) return;
        setSharedContent(prev => ({ ...prev!, scratchpad: newText }));
        if (scratchpadUpdateTimeout.current) {
            clearTimeout(scratchpadUpdateTimeout.current);
        }
        scratchpadUpdateTimeout.current = window.setTimeout(async () => {
            await updateDoc(contentDocRef, { scratchpad: newText });
        }, 500);
    };

    const handleWhiteboardDraw = async (newData: any) => {
        await updateDoc(contentDocRef, { whiteboardData: newData });
    };

    const handleSendMessage = async (content: { text?: string; imageUrl?: string }) => {
        if (!currentUser || !id) return;
        
        if ((!content.text || !content.text.trim()) && !content.imageUrl) return;

        if (content.text && isMessageInappropriate(content.text)) {
            alert("Your message could not be sent due to inappropriate content.");
            return;
        }

        try {
            const messagesColRef = collection(db, "studyGroups", id, "messages");
            await addDoc(messagesColRef, {
                senderId: currentUser.uid,
                conversationId: id,
                ...content,
                timestamp: Date.now(),
                senderUsername: currentUser.username,
                senderPhotoURL: currentUser.photoURL || null,
            });
        } catch (error) {
            console.error("Failed to send group message:", error);
            if (content.text) setNewMessage(content.text);
        }
    };

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = newMessage.trim();
        if (!textToSend) return;
        setNewMessage('');
        handleSendMessage({ text: textToSend });
    };
    
    const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadError('');
            handleImageUpload(file);
        }
    };

    const handleImageUpload = (file: File) => {
        if (!currentUser || !id) return;

        setIsUploadingImage(true);
        setUploadError('');
        const storageRef = ref(storage, `group-chat-images/${id}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            () => {},
            (error) => {
                console.error("Image upload failed:", error);
                setUploadError("Image upload failed. You might not have permission to upload to this group.");
                setIsUploadingImage(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await handleSendMessage({ imageUrl: downloadURL });
                setIsUploadingImage(false);
            }
        );
    };
    
    const handleUpdateName = async () => {
        if (!id || !newName.trim() || !group) return;
        if(newName.trim() === group.name) {
            setIsEditingName(false);
            return;
        }
        await updateDoc(groupDocRef, { name: newName.trim() });
        setIsEditingName(false);
    };

    const handleInviteBuddy = async (buddyId: string) => {
        if (!id) return;
        await updateDoc(groupDocRef, {
            memberIds: arrayUnion(buddyId)
        });
        setIsInviteDropdownOpen(false);
    };

    const handleLeaveGroup = async () => {
        if (!currentUser || !group) return;
        await updateDoc(groupDocRef, {
            memberIds: arrayRemove(currentUser.uid)
        });
        navigate('/groups');
    };
    
    const handleDeleteGroup = async () => {
        if (!group || !currentUser || group.creatorId !== currentUser.uid) return;
        if (!window.confirm("Are you sure you want to delete this group? This will remove all members and delete all chat history and content. This action cannot be undone.")) {
            return;
        }
        try {
            const batch = writeBatch(db);
            const messagesQuery = query(collection(db, "studyGroups", group.id, "messages"));
            const messagesSnapshot = await getDocs(messagesQuery);
            messagesSnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(contentDocRef);
            batch.delete(groupDocRef);
            await batch.commit();
            navigate('/groups');
        } catch (error) {
            console.error("Error deleting group:", error);
            alert("Failed to delete group.");
        }
    }
    
    const handleScheduleSession = async (topic: string, scheduledAt: number) => {
        if (!currentUser) return;
        const session: ScheduledSession = {
            topic,
            scheduledAt,
            scheduledBy: currentUser.username,
        };
        await updateDoc(groupDocRef, { scheduledSession: session });
        setScheduleModalOpen(false);
    };

    const handleClearSession = async () => {
        await updateDoc(groupDocRef, { scheduledSession: null });
    };

    if (loading) return <LoadingSpinner />;
    if (!group) return <div className="container mx-auto p-8 animate-fadeInUp text-center"><h1 className="text-2xl">Group not found.</h1></div>
    if (!sharedContent) return <LoadingSpinner />;

    const isCreator = currentUser?.uid === group.creatorId;
    const buddiesToInvite = buddies.filter(buddy => !group.memberIds.includes(buddy.uid));
    const showPinnedSession = group.scheduledSession && group.scheduledSession.scheduledAt > Date.now();

    return (
        <div className="container mx-auto p-8">
            <ScheduleSessionModal isOpen={isScheduleModalOpen} onClose={() => setScheduleModalOpen(false)} onSchedule={handleScheduleSession} />
            <Modal isOpen={!!viewedImageUrl} onClose={() => setViewedImageUrl(null)} className="max-w-4xl p-0 bg-transparent border-none shadow-none" showCloseButton={false}>
                {viewedImageUrl && (
                    <img src={viewedImageUrl} alt="Full screen view" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
                )}
            </Modal>

            {isEditingName ? (
                <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="text" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)} 
                        className="text-4xl font-bold bg-transparent border-b-2 border-primary focus:outline-none text-onBackground"
                        onBlur={handleUpdateName}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                        autoFocus
                    />
                    <button onClick={handleUpdateName} className="p-1 text-green-400 hover:scale-110 transition-transform" aria-label="Save name"><CheckCircleIcon className="w-8 h-8"/></button>
                    <button onClick={() => setIsEditingName(false)} className="p-1 text-red-400 hover:scale-110 transition-transform" aria-label="Cancel edit name"><XCircleIcon className="w-8 h-8"/></button>
                </div>
            ) : (
                <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-4xl font-bold text-onBackground">{group.name}</h1>
                    {isCreator && (
                        <button onClick={() => { setIsEditingName(true); setNewName(group.name); }} className="text-onSurface hover:text-primary" aria-label="Edit group name">
                            <PencilIcon className="w-6 h-6"/>
                        </button>
                    )}
                </div>
            )}
            <p className="text-onSurface mb-6">{group.description}</p>
            
            {showPinnedSession && (
                <div className="bg-primary/20 border border-primary/50 p-4 rounded-lg mb-8 animate-fadeInDown flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-primary flex items-center gap-2"><CalendarIcon /> Upcoming Session</h3>
                        <p className="font-semibold text-onBackground mt-1">{group.scheduledSession!.topic}</p>
                        <p className="text-sm text-onSurface">{new Date(group.scheduledSession!.scheduledAt).toLocaleString()}</p>
                    </div>
                    {(isCreator || group.scheduledSession?.scheduledBy === currentUser?.username) && (
                        <button onClick={handleClearSession} className="text-xs text-danger hover:underline">Clear</button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 flex flex-col gap-8">
                     <div className="w-full bg-surface p-6 rounded-lg shadow-md border border-gray-700">
                        <h2 className="text-2xl font-semibold mb-4 text-onBackground text-center">Shared Scratchpad</h2>
                        <textarea 
                            className="w-full h-96 p-4 border border-gray-600 rounded-lg shadow-inner font-mono text-sm bg-background text-onBackground focus:ring-primary focus:border-primary"
                            value={sharedContent.scratchpad}
                            onChange={(e) => handleScratchpadChange(e.target.value)}
                        />
                    </div>
                    <div className="w-full bg-surface p-6 rounded-lg shadow-md border border-gray-700">
                        <h2 className="text-2xl font-semibold mb-4 text-onBackground text-center">Group Quiz</h2>
                        <QuizComponent group={group} />
                    </div>
                     <div className="w-full flex flex-col items-center">
                        <h2 className="text-2xl font-semibold mb-4 text-onBackground">Shared Whiteboard</h2>
                        <Whiteboard onDraw={handleWhiteboardDraw} initialData={sharedContent.whiteboardData}/>
                    </div>
                </div>
                
                <div className="lg:col-span-1 flex flex-col gap-8 lg:sticky top-24 h-full">
                     <div className="bg-surface p-4 rounded-lg shadow-md border border-gray-700 h-96 lg:h-[calc(100vh-18rem)] flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 text-onBackground flex-shrink-0">Group Chat</h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 bg-background chat-background p-2 rounded-md">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex items-start gap-2 ${msg.senderId === currentUser?.uid ? 'flex-row-reverse' : ''}`}>
                                     <Avatar user={{ uid: msg.senderId, username: msg.senderUsername || '?', email: '', photoURL: msg.senderPhotoURL || undefined }} className="w-8 h-8 mt-1 flex-shrink-0" />
                                    <div className={`max-w-xs rounded-lg ${msg.senderId === currentUser?.uid ? 'bg-primary text-onPrimary' : 'bg-gray-700 text-onBackground'}`}>
                                        {msg.senderId !== currentUser?.uid && <p className="font-semibold text-xs text-primary mb-1 px-3 pt-2">{msg.senderUsername || 'User'}</p>}
                                        {msg.text && <p className="whitespace-pre-wrap text-sm px-3 py-2">{msg.text}</p>}
                                        {msg.imageUrl && (
                                            <button onClick={() => setViewedImageUrl(msg.imageUrl)}>
                                                <img src={msg.imageUrl} alt="Shared in chat" className="rounded-lg max-w-full h-auto cursor-pointer" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                             {isUploadingImage && (
                                <div className="flex items-end justify-end mb-4">
                                    <div className="max-w-xs p-2 rounded-lg bg-primary opacity-50">
                                        <p className="text-sm text-white">Uploading image...</p>
                                    </div>
                                </div>
                             )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="mt-4 flex-shrink-0">
                            {uploadError && <p className="text-danger text-xs text-center mb-2">{uploadError}</p>}
                            <form onSubmit={handleTextSubmit} className="flex gap-2 items-center">
                                <input type="file" ref={imageInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                                <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-onSurface hover:text-primary transition-colors">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={e => { setNewMessage(e.target.value); setUploadError(''); }}
                                    placeholder="Say something..."
                                    className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"
                                />
                                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform active:scale-95">Send</button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-surface p-6 rounded-lg shadow-md border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                           <h2 className="text-2xl font-semibold text-onBackground">Members ({members.length})</h2>
                           {!isCreator && (
                                <button onClick={handleLeaveGroup} className="font-semibold text-sm text-danger hover:underline">Leave</button>
                           )}
                        </div>
                         <div className="flex -space-x-4 mb-4">
                            {members.slice(0, 5).map(member => (
                                <Avatar key={member.uid} user={member} className="w-12 h-12 border-2 border-surface rounded-full" />
                            ))}
                            {members.length > 5 && (
                                <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold border-2 border-surface">
                                    +{members.length - 5}
                                </div>
                            )}
                         </div>
                         <div className="relative">
                            <div className="grid grid-cols-1 gap-2">
                                <button onClick={() => setScheduleModalOpen(true)} className="w-full text-center py-2 bg-secondary/80 hover:bg-secondary rounded-lg transition-colors font-semibold flex items-center justify-center gap-2">
                                    <CalendarIcon className="w-5 h-5" /> Schedule Session
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsMembersListVisible(!isMembersListVisible)} 
                                        className="flex-1 text-center py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                                    >
                                        <UsersIcon className="w-5 h-5" />
                                        <span>{isMembersListVisible ? 'Hide' : 'View All'}</span>
                                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isMembersListVisible ? 'rotate-180' : ''}`} />
                                    </button>
                                    <button 
                                        onClick={() => setIsInviteDropdownOpen(!isInviteDropdownOpen)}
                                        className="flex-1 text-center py-2 bg-primary/80 hover:bg-primary rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                                    >
                                    <PlusCircleIcon className="w-5 h-5"/>
                                    Invite
                                    </button>
                                </div>
                            </div>

                            {isCreator && (
                                <button onClick={handleDeleteGroup} className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm text-danger font-semibold hover:bg-danger/10 rounded-lg transition-colors">
                                    <TrashIcon className="w-4 h-4" /> Delete Group
                                </button>
                            )}

                            {isMembersListVisible && (
                                <div className="mt-2 p-2 bg-background rounded-lg border border-gray-600 shadow-xl max-h-60 overflow-y-auto animate-fadeInUp">
                                    <ul className="space-y-2">
                                        {members.map(member => (
                                            <li key={member.uid} className="flex items-center gap-3 p-2 rounded-md hover:bg-surface/50">
                                                <Avatar user={member} className="w-8 h-8" />
                                                <span className="font-semibold text-onBackground">{member.username}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            {isInviteDropdownOpen && (
                                <div className="absolute bottom-full right-0 mb-2 p-2 w-full bg-background rounded-lg border border-gray-600 shadow-xl max-h-60 overflow-y-auto z-10 animate-fadeInUp">
                                    {loadingBuddies ? (
                                        <p className="text-onSurface p-2">Loading buddies...</p>
                                    ) : buddiesToInvite.length > 0 ? (
                                        <ul className="space-y-2">
                                            {buddiesToInvite.map(buddy => (
                                                <li key={buddy.uid} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-surface/50">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar user={buddy} className="w-8 h-8" />
                                                        <span className="font-semibold text-onBackground">{buddy.username}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleInviteBuddy(buddy.uid)}
                                                        className="px-3 py-1 text-sm bg-secondary/80 hover:bg-secondary text-white rounded-md transition"
                                                    >
                                                        Invite
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-onSurface p-2 text-sm text-center">No buddies available to invite.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupPage;