
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db, storage } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { DiscoverPost } from '../../types';
import Avatar from '../core/Avatar';
import { PaperClipIcon, HeartIcon, ChatBubbleIcon, XCircleIcon } from '../icons';
import CommentModal from './CommentModal';

const DiscoverPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [posts, setPosts] = useState<DiscoverPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [postText, setPostText] = useState('');
    const [postImageFile, setPostImageFile] = useState<File | null>(null);
    const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [commentModalPostId, setCommentModalPostId] = useState<string | null>(null);

    useEffect(() => {
        const postsQuery = query(collection(db, "discoverPosts"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscoverPost));
            setPosts(postsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPostImageFile(file);
            setPostImagePreview(URL.createObjectURL(file));
        }
    };
    
    const cancelImage = () => {
        setPostImageFile(null);
        setPostImagePreview(null);
        if(imageInputRef.current) imageInputRef.current.value = "";
    }

    const handleCreatePost = async () => {
        if (!currentUser || (!postText.trim() && !postImageFile)) return;

        setIsUploading(true);

        let mediaUrl: string | undefined = undefined;
        let mediaType: 'image' | undefined = undefined;

        if (postImageFile) {
            mediaType = 'image';
            const storageRef = ref(storage, `discover-media/${currentUser.uid}/${Date.now()}_${postImageFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, postImageFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error("Upload failed:", error);
                        setIsUploading(false);
                        reject(error);
                    },
                    async () => {
                        mediaUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    }
                );
            });
        }
        
        await addDoc(collection(db, "discoverPosts"), {
            creatorId: currentUser.uid,
            creatorUsername: currentUser.username,
            creatorPhotoURL: currentUser.photoURL || null,
            text: postText,
            mediaUrl,
            mediaType,
            likes: [],
            commentCount: 0,
            createdAt: Date.now(),
        });

        setPostText('');
        cancelImage();
        setIsUploading(false);
        setUploadProgress(0);
    };
    
    const handleLike = async (post: DiscoverPost) => {
        if(!currentUser) return;
        const postRef = doc(db, "discoverPosts", post.id);
        const isLiked = post.likes.includes(currentUser.uid);
        await updateDoc(postRef, {
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
    }

    const PostCard: React.FC<{ post: DiscoverPost }> = ({ post }) => {
        const isLiked = currentUser ? post.likes.includes(currentUser.uid) : false;
        
        return (
            <div className="bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 border border-gray-800/50">
                <div className="flex items-center gap-3">
                    <Avatar user={{uid: post.creatorId, username: post.creatorUsername, email: '', photoURL: post.creatorPhotoURL}} className="w-12 h-12"/>
                    <div>
                        <h3 className="text-lg font-bold text-onBackground">{post.creatorUsername}</h3>
                        <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                {post.text && <p className="text-onSurface whitespace-pre-wrap">{post.text}</p>}

                {post.mediaUrl && post.mediaType === 'image' && (
                    <img src={post.mediaUrl} alt="Post media" className="rounded-lg max-h-[600px] w-full object-contain" />
                )}

                <div className="flex items-center justify-end gap-6 pt-2 border-t border-gray-700/50">
                    <button onClick={() => handleLike(post)} className={`flex items-center gap-2 text-onSurface transition-colors duration-200 ${isLiked ? 'text-rose-500' : 'hover:text-rose-500'}`}>
                        <HeartIcon filled={isLiked} className="w-6 h-6"/> 
                        <span className="font-semibold">{post.likes.length}</span>
                    </button>
                    <button onClick={() => setCommentModalPostId(post.id)} className="flex items-center gap-2 text-onSurface hover:text-primary transition-colors duration-200">
                        <ChatBubbleIcon className="w-6 h-6"/>
                        <span className="font-semibold">{post.commentCount}</span>
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 md:p-8 max-w-3xl">
            {commentModalPostId && <CommentModal postId={commentModalPostId} onClose={() => setCommentModalPostId(null)} />}
            <h1 className="text-4xl font-bold mb-6">Discover</h1>

            <div className="bg-surface p-4 rounded-xl shadow-lg mb-8 border border-gray-800/50">
                <textarea 
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    placeholder={`What's on your mind, ${currentUser?.username}?`}
                    className="w-full bg-transparent p-2 text-lg text-onBackground placeholder-gray-500 focus:outline-none resize-none"
                    rows={3}
                />
                {postImagePreview && (
                    <div className="relative mt-2">
                        <img src={postImagePreview} alt="Preview" className="rounded-lg max-h-80 w-auto" />
                        <button onClick={cancelImage} className="absolute top-2 right-2 bg-black/50 rounded-full text-white">
                            <XCircleIcon className="w-8 h-8"/>
                        </button>
                    </div>
                )}
                {isUploading && uploadProgress > 0 && (
                    <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                        <div className="bg-primary h-1 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
                    <input type="file" ref={imageInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
                    <button onClick={() => imageInputRef.current?.click()} className="p-2 text-onSurface hover:text-primary transition-colors" title="Add image">
                        <PaperClipIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={handleCreatePost} disabled={isUploading || (!postText.trim() && !postImageFile)} className="px-6 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        {isUploading ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>

            {loading ? <p className="text-center text-onSurface">Loading feed...</p> : (
                <div className="space-y-8">
                    {posts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
            )}
        </div>
    );
};

export default DiscoverPage;
