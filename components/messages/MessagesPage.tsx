import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { collection, query, orderBy, onSnapshot, doc, getDoc, writeBatch, getDocs, updateDoc, arrayRemove, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { User, Message } from '../../types';
import Avatar from '../core/Avatar';
import { sendMessageToBuddy } from '../../lib/messaging';
import { PaperClipIcon, TrashIcon } from '../icons';
import Modal from '../core/Modal';

const MessagesPage: React.FC = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [buddies, setBuddies] = useState<User[]>([]);
    const [selectedBuddy, setSelectedBuddy] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [viewedImageUrl, setViewedImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        // FIX: Removed orderBy("lastMessageTimestamp", "desc") to avoid needing a composite index.
        // Sorting will be handled client-side after fetching.
        const conversationsQuery = query(
            collection(db, "conversations"),
            where("participants", "array-contains", currentUser.uid)
        );

        const unsubscribe = onSnapshot(conversationsQuery, async (snapshot) => {
            const conversations = snapshot.docs.map(doc => doc.data());

            // Sort conversations by most recent message on the client
            conversations.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));

            const sortedBuddyIdsFromConvos = conversations
                .flatMap(conv => conv.participants)
                .filter(uid => uid !== currentUser.uid);
            
            const allConnectionIds = currentUser.connections || [];
            const unsortedBuddyIds = allConnectionIds.filter(uid => !sortedBuddyIdsFromConvos.includes(uid));

            const finalBuddyIds = [...new Set([...sortedBuddyIdsFromConvos, ...unsortedBuddyIds])];

            if (finalBuddyIds.length === 0) {
                setBuddies([]);
                setSelectedBuddy(null);
                return;
            }

            const buddyDataPromises = finalBuddyIds.map(async (uid) => {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                    return { uid: userDoc.id, ...userDoc.data() } as User;
                }
                return null;
            });

            const allBuddies = (await Promise.all(buddyDataPromises)).filter((b): b is User => b !== null);

            setBuddies(allBuddies);
            
            if (allBuddies.length > 0) {
                const initialBuddyId = location.state?.selectedBuddyId;
                const currentBuddyStillExists = selectedBuddy && allBuddies.some(b => b.uid === selectedBuddy.uid);

                let buddyToSelect = selectedBuddy;

                if (initialBuddyId) {
                    buddyToSelect = allBuddies.find(b => b.uid === initialBuddyId) || allBuddies[0];
                    navigate(location.pathname, { replace: true, state: {} });
                } else if (!currentBuddyStillExists) {
                    buddyToSelect = allBuddies[0];
                }
                
                if (buddyToSelect?.uid !== selectedBuddy?.uid) {
                    setSelectedBuddy(buddyToSelect);
                }

            } else {
                setSelectedBuddy(null);
            }
        });

        return () => unsubscribe();
    }, [currentUser, location.state, navigate]);

    useEffect(() => {
        if (!selectedBuddy || !currentUser) {
            setMessages([]);
            return;
        };
        
        const conversationId = [currentUser.uid, selectedBuddy.uid].sort().join('-');
        const messagesQuery = query(collection(db, "conversations", conversationId, "messages"), orderBy("timestamp", "asc"));

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(fetchedMessages);
        });

        return () => unsubscribe();
    }, [selectedBuddy, currentUser]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = newMessage.trim();
        if (!textToSend || !currentUser || !selectedBuddy) return;

        setNewMessage('');

        try {
            await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, { text: textToSend });
        } catch (error: any) {
            if (error.message !== "Inappropriate content") {
                console.error("Failed to send message:", error);
                setNewMessage(textToSend); // Restore message on other failures
            }
             // If it's inappropriate content, the message is already cleared and user alerted by the helper.
        }
    };

    const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadError('');
            handleImageUpload(file);
        }
    };

    const handleImageUpload = (file: File) => {
        if (!currentUser || !selectedBuddy) return;

        setIsUploadingImage(true);
        setUploadError('');
        const storageRef = ref(storage, `chat-images/${[currentUser.uid, selectedBuddy.uid].sort().join('-')}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            () => {},
            (error) => {
                console.error("Image upload failed:", error);
                setUploadError("Image upload failed. You might not have permission.");
                setIsUploadingImage(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, { imageUrl: downloadURL });
                setIsUploadingImage(false);
            }
        );
    };

    const handleDeleteChat = async () => {
        if (!currentUser || !selectedBuddy) return;

        const conversationId = [currentUser.uid, selectedBuddy.uid].sort().join('-');
        const conversationRef = doc(db, "conversations", conversationId);
        const messagesColRef = collection(conversationRef, "messages");

        try {
            // Batch delete messages to handle >500 messages per transaction limit
            const messagesSnapshot = await getDocs(messagesColRef);
            if (!messagesSnapshot.empty) {
                const batchSize = 500;
                for (let i = 0; i < messagesSnapshot.docs.length; i += batchSize) {
                    const batch = writeBatch(db);
                    const chunk = messagesSnapshot.docs.slice(i, i + batchSize);
                    chunk.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }

            // Final batch for conversation doc and user connections
            const finalBatch = writeBatch(db);
            
            // Delete conversation document
            finalBatch.delete(conversationRef);

            // Remove buddy connection from both users
            const currentUserRef = doc(db, "users", currentUser.uid);
            const selectedBuddyRef = doc(db, "users", selectedBuddy.uid);

            finalBatch.update(currentUserRef, { connections: arrayRemove(selectedBuddy.uid) });
            finalBatch.update(selectedBuddyRef, { connections: arrayRemove(currentUser.uid) });
            
            await finalBatch.commit();

            // Update local state for a smooth UI transition
            setMessages([]);
            const remainingBuddies = buddies.filter(b => b.uid !== selectedBuddy.uid);
            setBuddies(remainingBuddies); // Update the buddies list
            setSelectedBuddy(remainingBuddies.length > 0 ? remainingBuddies[0] : null);
            
        } catch (error) {
            console.error("Error deleting chat:", error);
            alert("Failed to delete chat. Please try again.");
        }
    };
    
    const showChat = !isMobile || (isMobile && selectedBuddy);
    const showContacts = !isMobile || (isMobile && !selectedBuddy);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Messages</h1>
            <div className="flex flex-col md:flex-row rounded-lg h-[calc(100vh-12rem)] border border-gray-700/50 overflow-hidden">
                {/* Buddies List */}
                {showContacts && (
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-700/50 flex flex-col h-full bg-surface/30 backdrop-blur-lg">
                        <div className="p-4 border-b border-gray-700/50">
                            <h2 className="text-xl font-semibold text-onBackground">Contacts</h2>
                        </div>
                        <ul className="overflow-y-auto">
                            {buddies.map(buddy => (
                                <li key={buddy.uid} onClick={() => setSelectedBuddy(buddy)} className={`p-4 flex items-center gap-3 cursor-pointer transition-colors duration-[260ms] hover:bg-gray-800/50 ${selectedBuddy?.uid === buddy.uid ? 'bg-primary/30' : ''}`}>
                                    <Avatar user={buddy} className="w-12 h-12" />
                                    <div>
                                        <p className="font-semibold text-onBackground">{buddy.username}</p>
                                    </div>
                                </li>
                            ))}
                             {buddies.length === 0 && <p className="p-4 text-onSurface">No buddies yet.</p>}
                        </ul>
                    </div>
                )}

                {/* Chat Window */}
                {showChat && (
                    <div className="w-full md:w-2/3 flex flex-col flex-1 h-full bg-surface">
                        {selectedBuddy ? (
                            <>
                                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isMobile && (
                                            <button onClick={() => setSelectedBuddy(null)} className="mr-2 text-onSurface">&larr;</button>
                                        )}
                                        <Avatar user={selectedBuddy} className="w-10 h-10" />
                                        <h2 className="text-xl font-semibold text-onBackground">{selectedBuddy.username}</h2>
                                    </div>
                                     <button onClick={handleDeleteChat} className="p-2 text-danger/70 hover:text-danger hover:bg-danger/20 rounded-full transition-colors" title="Unfriend & Delete Chat">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto bg-background chat-background">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex mb-4 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs lg:max-w-md rounded-lg shadow-sm ${msg.senderId === currentUser?.uid ? 'bg-primary text-white' : 'bg-gray-700 text-onBackground'}`}>
                                                {msg.text && <p className="px-4 py-2 whitespace-pre-wrap">{msg.text}</p>}
                                                {msg.imageUrl && (
                                                    <button onClick={() => setViewedImageUrl(msg.imageUrl)}>
                                                        <img src={msg.imageUrl} alt="Shared content" className="rounded-lg max-w-full h-auto cursor-pointer" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isUploadingImage && (
                                        <div className="flex justify-end mb-4">
                                            <div className="max-w-xs lg:max-w-md p-2 rounded-lg bg-primary opacity-50">
                                                <p className="text-sm text-white">Uploading...</p>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t border-gray-700 bg-surface">
                                    {uploadError && <p className="text-danger text-xs mb-2 text-center">{uploadError}</p>}
                                    <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                                        <input type="file" ref={imageInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                                        <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-onSurface hover:text-primary transition-colors">
                                            <PaperClipIcon className="w-6 h-6" />
                                        </button>
                                        <input type="text" value={newMessage} onChange={e => { setNewMessage(e.target.value); setUploadError(''); }} placeholder="Type a message..." className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"/>
                                        <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform active:scale-95">Send</button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-onSurface">
                                <p>Select a buddy to start chatting.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Modal isOpen={!!viewedImageUrl} onClose={() => setViewedImageUrl(null)} className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center" showCloseButton={false}>
                {viewedImageUrl && (
                    <img src={viewedImageUrl} alt="Full screen view" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
                )}
            </Modal>
        </div>
    );
};

export default MessagesPage;