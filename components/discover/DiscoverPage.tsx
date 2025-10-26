import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { db, storage } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { DiscoverPost } from '../../types';
import Avatar from '../core/Avatar';
import Modal from '../core/Modal';
import { PlusCircleIcon, HeartIcon, ChatBubbleIcon, CompassIcon } from '../icons';
import CommentModal from './CommentModal';

const DiscoverPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [posts, setPosts] = useState<DiscoverPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [commentPostId, setCommentPostId] = useState<string | null>(null);

    useEffect(() => {
        const postsQuery = query(collection(db, "discoverPosts"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscoverPost));
            setPosts(postsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleLikeToggle = async (post: DiscoverPost) => {
        if (!currentUser) return;
        const postRef = doc(db, "discoverPosts", post.id);
        const alreadyLiked = post.likes.includes(currentUser.uid);
        
        await updateDoc(postRef, {
            likes: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
    };

    const CreatePostModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
        const [text, setText] = useState('');
        const [imageFile, setImageFile] = useState<File | null>(null);
        const [imagePreview, setImagePreview] = useState<string | null>(null);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const fileInputRef = useRef<HTMLInputElement>(null);

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!text.trim() && !imageFile) return;
            if (!currentUser) return;
            setIsSubmitting(true);

            let mediaUrl: string | undefined = undefined;

            if (imageFile) {
                const storageRef = ref(storage, `discover-posts/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
                const uploadTask = await uploadBytesResumable(storageRef, imageFile);
                mediaUrl = await getDownloadURL(uploadTask.ref);
            }

            const newPost: Omit<DiscoverPost, 'id'> = {
                creatorId: currentUser.uid,
                creatorUsername: currentUser.username,
                creatorPhotoURL: currentUser.photoURL || undefined,
                text: text.trim() || undefined,
                mediaUrl: mediaUrl,
                mediaType: mediaUrl ? 'image' : undefined,
                likes: [],
                commentCount: 0,
                createdAt: Date.now(),
            };
            
            await addDoc(collection(db, "discoverPosts"), newPost);
            setIsSubmitting(false);
            onClose();
        };

        return (
            <Modal isOpen={true} onClose={onClose}>
                <h2 className="text-2xl font-bold mb-4 text-onBackground">Create a New Post</h2>
                <form onSubmit={handleSubmit}>
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="What's on your mind?"
                        className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-primary focus:border-primary"
                        rows={5}
                    />
                    <div className="mt-4">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline">
                            {imagePreview ? 'Change Image' : 'Add Image'}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*"/>
                    </div>
                    {imagePreview && <img src={imagePreview} alt="Preview" className="mt-4 max-h-60 rounded-lg"/>}
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-indigo-500 transition disabled:opacity-50">
                            {isSubmitting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </form>
            </Modal>
        );
    };
    
    const ReelsCard = () => (
        <Link to="/discover/reels" className="block p-6 rounded-2xl bg-gradient-to-br from-indigo-800 to-purple-800 shadow-lg border border-purple-600 group hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1">
            <div className="flex flex-col items-center text-center">
                 <div className="p-4 bg-white/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                     <CompassIcon className="w-10 h-10 text-white" />
                 </div>
                 <h2 className="text-2xl font-bold text-white">Fun Fact Reels</h2>
                 <p className="text-indigo-200 mt-2">Swipe through an endless feed of AI-generated fun facts and trivia!</p>
            </div>
        </Link>
    );

    return (
        <div className="container mx-auto p-4 sm:p-8">
            {isCreateModalOpen && <CreatePostModal onClose={() => setCreateModalOpen(false)} />}
            {commentPostId && <CommentModal postId={commentPostId} onClose={() => setCommentPostId(null)} />}
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl sm:text-4xl font-bold">Discover</h1>
                <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition">
                   <PlusCircleIcon className="w-5 h-5" />
                   <span className="hidden sm:inline">New Post</span>
                </button>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
                <ReelsCard />

                {loading ? <p className="text-center">Loading posts...</p> : posts.map(post => (
                    <div key={post.id} className="bg-surface rounded-xl shadow-lg p-6 border border-gray-700/50">
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar user={{uid: post.creatorId, username: post.creatorUsername, email:'', photoURL: post.creatorPhotoURL}} className="w-12 h-12" />
                            <div>
                                <p className="font-bold text-onBackground">{post.creatorUsername}</p>
                                <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
                            </div>
                        </div>
                        {post.text && <p className="text-onSurface mb-4">{post.text}</p>}
                        {post.mediaUrl && <img src={post.mediaUrl} alt="Post media" className="rounded-lg max-h-[500px] w-full object-cover"/>}
                        <div className="mt-4 pt-3 border-t border-gray-700 flex items-center gap-6 text-onSurface">
                            <button onClick={() => handleLikeToggle(post)} className="flex items-center gap-2 hover:text-danger transition-colors">
                                <HeartIcon filled={currentUser ? post.likes.includes(currentUser.uid) : false} className={`w-6 h-6 ${currentUser && post.likes.includes(currentUser.uid) ? 'text-danger' : ''}`} />
                                <span>{post.likes.length}</span>
                            </button>
                            <button onClick={() => setCommentPostId(post.id)} className="flex items-center gap-2 hover:text-primary transition-colors">
                                <ChatBubbleIcon className="w-6 h-6" />
                                <span>{post.commentCount}</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DiscoverPage;