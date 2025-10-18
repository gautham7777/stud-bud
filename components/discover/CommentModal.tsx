
import React, { useState, useEffect, useRef } from 'react';
import Modal from '../core/Modal';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, writeBatch } from 'firebase/firestore';
import { DiscoverComment } from '../../types';
import Avatar from '../core/Avatar';

const CommentModal: React.FC<{
    postId: string;
    onClose: () => void;
}> = ({ postId, onClose }) => {
    const { currentUser } = useAuth();
    const [comments, setComments] = useState<DiscoverComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const commentsQuery = query(collection(db, "discoverPosts", postId, "comments"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscoverComment));
            setComments(commentsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [postId]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newComment.trim()) return;

        setIsSubmitting(true);
        const commentText = newComment.trim();
        setNewComment('');

        try {
            const batch = writeBatch(db);
            
            // 1. Add new comment document
            const commentsColRef = collection(db, "discoverPosts", postId, "comments");
            const newCommentRef = doc(commentsColRef); // Create ref with new ID
            batch.set(newCommentRef, {
                postId,
                creatorId: currentUser.uid,
                creatorUsername: currentUser.username,
                creatorPhotoURL: currentUser.photoURL || null,
                text: commentText,
                createdAt: Date.now(),
            });

            // 2. Increment comment count on parent post
            const postRef = doc(db, "discoverPosts", postId);
            batch.update(postRef, { commentCount: comments.length + 1 }); // Use server-side increment for more robustness if needed

            await batch.commit();

        } catch (error) {
            console.error("Error submitting comment: ", error);
            setNewComment(commentText); // Restore text on failure
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} className="max-w-2xl h-[80vh] flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-onBackground flex-shrink-0">Comments</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
                {loading ? <p>Loading comments...</p> : comments.length > 0 ? (
                    comments.map(comment => (
                        <div key={comment.id} className="flex items-start gap-3">
                            <Avatar user={{uid: comment.creatorId, username: comment.creatorUsername, email: '', photoURL: comment.creatorPhotoURL}} className="w-10 h-10 flex-shrink-0" />
                            <div className="bg-background p-3 rounded-lg flex-1">
                                <div className="flex items-baseline gap-2">
                                    <p className="font-semibold text-onBackground">{comment.creatorUsername}</p>
                                    <p className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <p className="text-onSurface">{comment.text}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-onSurface">No comments yet. Be the first!</p>
                )}
                 <div ref={commentsEndRef} />
            </div>
            {currentUser && (
                <form onSubmit={handleSubmitComment} className="flex gap-2 flex-shrink-0 items-center border-t border-gray-700 pt-4">
                    <Avatar user={currentUser} className="w-10 h-10" />
                    <input 
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"
                    />
                    <button type="submit" disabled={isSubmitting || !newComment.trim()} className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition disabled:opacity-50">
                        Post
                    </button>
                </form>
            )}
        </Modal>
    );
};

export default CommentModal;
