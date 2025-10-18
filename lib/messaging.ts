import { doc, collection, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isMessageInappropriate } from './moderation';

export const sendMessageToBuddy = async (senderId: string, receiverId: string, content: { text?: string, imageUrl?: string }) => {
    if ((!content.text || !content.text.trim()) && !content.imageUrl) return;
    if (!senderId || !receiverId) return;

    if (content.text && isMessageInappropriate(content.text)) {
        alert("Your message could not be sent due to inappropriate content.");
        throw new Error("Inappropriate content"); // Throw to stop execution and allow caller to handle UI
    }

    const conversationId = [senderId, receiverId].sort().join('-');
    const conversationRef = doc(db, "conversations", conversationId);
    const messagesColRef = collection(conversationRef, "messages");
    
    const messageTimestamp = Date.now();

    await addDoc(messagesColRef, {
        senderId,
        ...content,
        timestamp: messageTimestamp,
        conversationId,
    });
    
    await setDoc(conversationRef, { 
        participants: [senderId, receiverId],
        lastMessageTimestamp: messageTimestamp,
    }, { merge: true });
};