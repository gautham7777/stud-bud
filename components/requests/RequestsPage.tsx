import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { collection, query, orderBy, onSnapshot, where, addDoc, writeBatch, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudyPost, StudyRequest } from '../../types';
import { ALL_SUBJECTS } from '../../constants';
import { getSubjectName } from '../../lib/helpers';
import Modal from '../core/Modal';
import Avatar from '../core/Avatar';
import { PlusCircleIcon, CheckCircleIcon, UsersIcon, XCircleIcon, TrashIcon } from '../icons';

const RequestsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [posts, setPosts] = useState<StudyPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [sentRequests, setSentRequests] = useState<StudyRequest[]>([]);
    
    useEffect(() => {
        if (!currentUser) return;
        const postsQuery = query(collection(db, "studyPosts"), orderBy("createdAt", "desc"));
        const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyPost));
            setPosts(postsData);
            setLoading(false);
        });

        const requestsQuery = query(collection(db, "studyRequests"), where("fromUserId", "==", currentUser.uid));
        const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRequest));
            setSentRequests(requests);
        });

        return () => {
            unsubPosts();
            unsubRequests();
        };
    }, [currentUser]);

    const getPostRequestStatus = (post: StudyPost) => {
        const request = sentRequests.find(r => r.postId === post.id);
        return request ? request.status : null;
    }

    const handleOfferHelp = async (post: StudyPost) => {
        const hasSentRequestForPost = sentRequests.some(req => req.postId === post.id);
        if (!currentUser || hasSentRequestForPost || currentUser.uid === post.creatorId) return;

        try {
            const newRequest: Omit<StudyRequest, 'id'> = {
                fromUserId: currentUser.uid,
                fromUsername: currentUser.username,
                toUserId: post.creatorId,
                toUsername: post.creatorUsername,
                status: 'pending',
                createdAt: Date.now(),
                postId: post.id,
            };
            await addDoc(collection(db, "studyRequests"), newRequest);
        } catch (error) {
            console.error("Error sending request: ", error);
            alert("Failed to send request.");
        }
    };

    const handleCreatePost = async (subjectIds: number[], description: string) => {
        if (!currentUser || subjectIds.length === 0 || !description.trim()) return;

        await addDoc(collection(db, "studyPosts"), {
            creatorId: currentUser.uid,
            creatorUsername: currentUser.username,
            creatorPhotoURL: currentUser.photoURL || null,
            subjectIds,
            description,
            createdAt: Date.now(),
        });
        setCreateModalOpen(false);
    };

    const handleDeletePost = async (postId: string) => {
        try {
            const batch = writeBatch(db);
            
            const requestsQuery = query(collection(db, "studyRequests"), where("postId", "==", postId));
            const requestsSnapshot = await getDocs(requestsQuery);
            requestsSnapshot.forEach(doc => batch.delete(doc.ref));

            const postDocRef = doc(db, "studyPosts", postId);
            batch.delete(postDocRef);

            await batch.commit();
        } catch (error) {
            console.error("Error deleting post:", error);
            alert("Failed to delete post.");
        }
    };

    const subjectColors = [
        'border-rose-500/50 bg-rose-500/20 text-rose-300',
        'border-amber-500/50 bg-amber-500/20 text-amber-300',
        'border-yellow-500/50 bg-yellow-500/20 text-yellow-300',
        'border-lime-500/50 bg-lime-500/20 text-lime-300',
        'border-green-500/50 bg-green-500/20 text-green-300',
        'border-emerald-500/50 bg-emerald-500/20 text-emerald-300',
        'border-teal-500/50 bg-teal-500/20 text-teal-300',
        'border-cyan-500/50 bg-cyan-500/20 text-cyan-300',
        'border-sky-500/50 bg-sky-500/20 text-sky-300',
        'border-indigo-500/50 bg-indigo-500/20 text-indigo-300',
    ];
    const getSubjectColorClass = (subjectId: number) => subjectColors[subjectId % subjectColors.length];
    
    const CreatePostModal: React.FC<{isOpen: boolean, onClose: () => void, onCreate: (subjectIds: number[], description: string) => void}> = ({isOpen, onClose, onCreate}) => {
        const [description, setDescription] = useState('');
        const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
        const [error, setError] = useState('');

        const handleSubjectSelect = (subjectId: number) => {
            setSelectedSubjects(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            setError('');
            if(selectedSubjects.length === 0) {
                setError('Please select at least one subject.');
                return;
            }
            if(!description.trim()) {
                setError('Please provide a description.');
                return;
            }
            onCreate(selectedSubjects, description);
            setSelectedSubjects([]);
            setDescription('');
        };

        return (
            <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
                 <h2 className="text-2xl font-bold mb-4 text-onBackground">Create a Study Request</h2>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-semibold text-onSurface mb-2">What subject(s) do you need help with?</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {ALL_SUBJECTS.map(subject => (
                                <div key={subject.id} onClick={() => handleSubjectSelect(subject.id)}
                                    className={`text-center p-3 rounded-lg cursor-pointer transition-all duration-[260ms] border-2 ${selectedSubjects.includes(subject.id) ? `${getSubjectColorClass(subject.id)} scale-105` : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`}>
                                    <span>{subject.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block font-semibold text-onSurface">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} required className="w-full mt-2 p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-primary focus:border-primary" rows={3} placeholder="e.g., 'I'm struggling with kinematic equations in Physics.'"></textarea>
                    </div>
                    {error && <p className="text-danger text-sm">{error}</p>}
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white rounded-md hover:from-indigo-600 hover:to-indigo-400 transition">Post Request</button>
                    </div>
                 </form>
            </Modal>
        )
    };

    const RequestCard: React.FC<{post: StudyPost}> = ({post}) => {
        const requestStatus = getPostRequestStatus(post);
        const isOwnPost = currentUser?.uid === post.creatorId;

        const getButtonContent = () => {
            if (isOwnPost) return <>This is your post</>;
            switch(requestStatus) {
                case 'pending': return <><CheckCircleIcon className="w-5 h-5"/> Request Sent</>;
                case 'accepted': return <><UsersIcon className="w-5 h-5"/> Help Accepted</>;
                case 'declined': return <><XCircleIcon className="w-5 h-5"/> Declined</>;
                default: return <><PlusCircleIcon className="w-5 h-5"/> Offer Help</>;
            }
        };
    
        const getButtonClasses = () => {
            let baseClasses = "w-full font-bold py-3 px-4 rounded-lg transition-all duration-[390ms] flex items-center justify-center gap-2 transform active:scale-95";
            if (requestStatus === 'accepted') {
                return `${baseClasses} bg-green-500 text-white cursor-default`;
            }
            if (requestStatus || isOwnPost) {
                return `${baseClasses} bg-gray-600 text-gray-400 cursor-not-allowed`;
            }
            return `${baseClasses} bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary hover:from-indigo-600 hover:to-indigo-400 hover:scale-105 shadow-md hover:shadow-lg hover:shadow-primary/30`;
        }

        return (
            <div className="bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 transition-all duration-[390ms] hover:shadow-2xl hover:-translate-y-1 hover:shadow-primary/20 border border-transparent hover:border-primary/50 relative">
                {isOwnPost && (
                    <button onClick={() => handleDeletePost(post.id)} className="absolute top-3 right-3 p-1.5 bg-danger/80 rounded-full text-white hover:bg-danger" title="Delete Request">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <Avatar user={{uid: post.creatorId, username: post.creatorUsername, email: '', photoURL: post.creatorPhotoURL}} className="w-12 h-12"/>
                    <div>
                        <h3 className="text-lg font-bold text-primary">{post.creatorUsername}</h3>
                        <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                </div>
                <p className="text-onSurface italic">"{post.description}"</p>
                <div>
                    <h4 className="font-semibold text-onBackground text-sm mb-2">Needs help with:</h4>
                    <div className="flex flex-wrap gap-2">
                        {post.subjectIds.map(id => (
                            <span key={id} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getSubjectColorClass(id)}`}>
                                {getSubjectName(id)}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="mt-auto pt-4">
                    <button onClick={() => handleOfferHelp(post)} disabled={!!requestStatus || isOwnPost} className={getButtonClasses()}>
                        {getButtonContent()}
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-8">
            <CreatePostModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreatePost} />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl sm:text-4xl font-bold">Study Requests</h1>
                <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-colors shadow-lg hover:shadow-primary/30">
                   <PlusCircleIcon className="w-5 h-5" />
                   <span className="hidden sm:inline">New Request</span>
                </button>
            </div>
            {loading ? <p>Loading requests...</p> : 
                posts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => <RequestCard key={post.id} post={post}/>)}
                    </div>
                ) : (
                    <p className="text-center text-onSurface col-span-full mt-10">No active requests. Be the first to post one!</p>
                )
            }
        </div>
    );
};

export default RequestsPage;