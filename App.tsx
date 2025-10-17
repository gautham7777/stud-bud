

import React, { useState, useContext, createContext, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { User, StudentProfile, StudyGroup, Message, SharedContent, StudyRequest, Subject, LearningStyle, StudyMethod, Quiz, QuizQuestion, UserQuizAttempt } from './types';
import { ALL_SUBJECTS, ALL_AVAILABILITY_OPTIONS, ALL_LEARNING_STYLES, ALL_STUDY_METHODS } from './constants';
import { BookOpenIcon, UsersIcon, ChatBubbleIcon, UserCircleIcon, LogoutIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, SearchIcon, SparklesIcon, TrophyIcon } from './components/icons';
import Whiteboard from './components/Whiteboard';

import { auth, db, storage } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where, addDoc, onSnapshot, arrayUnion, Timestamp, orderBy, serverTimestamp, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI, Type } from "@google/genai";


// --- AUTH CONTEXT ---
interface AuthContextType {
    currentUser: User | null;
    currentUserProfile: StudentProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
    signup: (email: string, username: string, pass: string, profileData: { subjectsNeedHelp: number[], subjectsCanHelp: number[] }) => Promise<void>;
    updateProfile: (profile: Partial<StudentProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let userUnsubscribe: () => void = () => {};
        let profileUnsubscribe: () => void = () => {};

        const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            userUnsubscribe();
            profileUnsubscribe();

            if (firebaseUser) {
                setLoading(true);
                const userDocRef = doc(db, "users", firebaseUser.uid);
                userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCurrentUser({ uid: docSnap.id, ...docSnap.data() } as User);
                    } else {
                        setCurrentUser(null);
                    }
                });

                const profileDocRef = doc(db, "profiles", firebaseUser.uid);
                profileUnsubscribe = onSnapshot(profileDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCurrentUserProfile(docSnap.data() as StudentProfile);
                    } else {
                        setCurrentUserProfile(null);
                    }
                    setLoading(false);
                });
            } else {
                setCurrentUser(null);
                setCurrentUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            authUnsubscribe();
            userUnsubscribe();
            profileUnsubscribe();
        };
    }, []);

    const login = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const logout = () => {
        signOut(auth);
    };

    const signup = async (email: string, username: string, pass: string, profileData: { subjectsNeedHelp: number[], subjectsCanHelp: number[] }) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const firebaseUser = userCredential.user;

        await setDoc(doc(db, "users", firebaseUser.uid), {email, username, connections: [], photoURL: null});
        
        const newProfile: StudentProfile = {
            userId: firebaseUser.uid,
            bio: '',
            learningStyle: LearningStyle.Visual,
            preferredMethods: [],
            availability: [],
            subjectsNeedHelp: profileData.subjectsNeedHelp,
            subjectsCanHelp: profileData.subjectsCanHelp,
            badges: [],
        };
        await setDoc(doc(db, "profiles", firebaseUser.uid), newProfile);
    };
    
     const checkForBadges = (profile: StudentProfile): string[] => {
        const newBadges: string[] = [];
        const isComplete = profile.bio && 
                           profile.learningStyle &&
                           profile.preferredMethods.length > 0 &&
                           profile.availability.length > 0;
        if (isComplete) {
            newBadges.push("Profile Pro");
        }
        return newBadges;
    };

    const updateProfile = async (updatedProfile: Partial<StudentProfile>) => {
        if (!currentUser || !currentUserProfile) throw new Error("Not authenticated");
        
        const newProfileData = { ...currentUserProfile, ...updatedProfile };
        
        const existingBadges = newProfileData.badges || [];
        const earnedBadges = checkForBadges(newProfileData);
        const allBadges = [...new Set([...existingBadges, ...earnedBadges])];
        
        const finalProfile = { ...newProfileData, ...updatedProfile, badges: allBadges };
        
        const profileDocRef = doc(db, "profiles", currentUser.uid);
        await setDoc(profileDocRef, finalProfile, { merge: true });
    };


    const value = useMemo(() => ({ currentUser, currentUserProfile, loading, login, logout, signup, updateProfile }), 
        [currentUser, currentUserProfile, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = () => useContext(AuthContext);

// --- HELPER COMPONENTS ---
const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
    </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, loading } = useAuth();
    if (loading) {
        return <LoadingSpinner />;
    }
    if (!currentUser) {
        return <Navigate to="/auth" />;
    }
    return <>{children}</>;
};

const Avatar: React.FC<{ user: User | null, className?: string}> = ({ user, className = 'w-10 h-10' }) => {
    if (!user) return <div className={`rounded-full bg-gray-700 ${className}`} />;

    if (user.photoURL) {
        return <img src={user.photoURL} alt={user.username} className={`rounded-full object-cover ${className}`} />;
    }
    
    const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];
    const color = colors[user.username.charCodeAt(0) % colors.length];

    return (
        <div className={`rounded-full flex items-center justify-center text-white font-bold ${color} ${className}`}>
            <span>{initial}</span>
        </div>
    );
};

// --- CORE UI COMPONENTS ---
const Header: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navItems = [
        { path: '/', label: 'Dashboard', icon: BookOpenIcon },
        { path: '/discover', label: 'Discover', icon: SearchIcon },
        { path: '/messages', label: 'Messages', icon: ChatBubbleIcon },
        { path: '/profile', label: 'Profile', icon: UserCircleIcon },
    ];

    if (!currentUser) return null;

    return (
        <header className="bg-surface/70 backdrop-blur-sm shadow-lg sticky top-0 z-20">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-2 text-primary font-bold text-xl transition-transform hover:scale-105">
                            <BookOpenIcon className="h-8 w-8" />
                            <span className="text-onBackground">StudyBuddy</span>
                        </Link>
                    </div>
                    <div className="hidden md:flex items-center space-x-4">
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${location.pathname === item.path ? 'bg-primary text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                    <div className="flex items-center gap-4">
                         <Avatar user={currentUser} className="w-10 h-10" />
                        <button onClick={logout} className="p-2 rounded-full text-onSurface hover:text-primary hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors duration-200 hidden md:block">
                            <LogoutIcon className="h-6 w-6" />
                        </button>
                         <div className="md:hidden">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full text-onSurface hover:text-primary hover:bg-surface/50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
                            </button>
                        </div>
                    </div>
                </div>
                {isMenuOpen && (
                     <div className="md:hidden pb-4">
                        {navItems.map(item => (
                            <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-md font-medium transition-all duration-200 ${location.pathname === item.path ? 'bg-primary text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}>
                                 <item.icon className="h-5 w-5" /> {item.label}
                            </Link>
                        ))}
                         <button onClick={() => { logout(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-md font-medium text-onSurface hover:bg-surface/50 hover:text-onBackground">
                            <LogoutIcon className="h-6 w-6" /> Logout
                        </button>
                    </div>
                )}
            </nav>
        </header>
    );
};

const getSubjectName = (id: number) => ALL_SUBJECTS.find(s => s.id === id)?.name || 'Unknown';

const Badge: React.FC<{ badge: string }> = ({ badge }) => (
    <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/50">
        <TrophyIcon className="w-3 h-3" />
        {badge}
    </span>
);


const UserCard: React.FC<{ 
    user: User; 
    profile: StudentProfile; 
    onConnect: () => void;
    requestStatus: 'pending' | 'accepted' | 'declined' | null;
    style?: React.CSSProperties;
    // FIX: Add className to props to allow passing CSS classes for styling.
    className?: string;
}> = ({ user, profile, onConnect, requestStatus, style, className }) => {
    
    const getButtonContent = () => {
        switch(requestStatus) {
            case 'pending':
                return <><CheckCircleIcon className="w-5 h-5"/> Request Sent</>;
            case 'accepted':
                return <><UsersIcon className="w-5 h-5"/> Connected</>;
            case 'declined':
                return <><XCircleIcon className="w-5 h-5"/> Declined</>;
            default:
                return <><PlusCircleIcon className="w-5 h-5"/> Send Request</>;
        }
    };

    const getButtonClasses = () => {
        let baseClasses = "w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95";
        if (requestStatus === 'accepted') {
            return `${baseClasses} bg-green-500 text-white cursor-default`;
        }
        if (requestStatus) {
            return `${baseClasses} bg-gray-600 text-gray-400 cursor-not-allowed`;
        }
        return `${baseClasses} bg-primary text-onPrimary hover:bg-indigo-500 hover:scale-105 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]`;
    }

    return (
        <div style={style} className={`bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:shadow-primary/20 border border-transparent hover:border-primary/50 ${className || ''}`}>
            <div className="flex items-center gap-4">
                <Avatar user={user} className="w-16 h-16 sm:w-20 sm:h-20 text-3xl"/>
                <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-primary">{user.username}</h3>
                    <p className="text-sm text-onSurface italic">"{profile.bio || 'No bio yet.'}"</p>
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-onBackground">Can Help With:</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                    {profile.subjectsCanHelp.length > 0 ? profile.subjectsCanHelp.map(id => <span key={id} className="bg-green-500/20 text-green-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{getSubjectName(id)}</span>) : <span className="text-gray-400 text-sm">Nothing listed</span>}
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-onBackground">Needs Help With:</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                     {profile.subjectsNeedHelp.length > 0 ? profile.subjectsNeedHelp.map(id => <span key={id} className="bg-yellow-500/20 text-yellow-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{getSubjectName(id)}</span>) : <span className="text-gray-400 text-sm">Nothing listed</span>}
                </div>
            </div>
             {profile.badges && profile.badges.length > 0 && (
                <div>
                    <h4 className="font-semibold text-onBackground text-sm">Badges:</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {profile.badges.map(badge => <Badge key={badge} badge={badge} />)}
                    </div>
                </div>
            )}
            <div className="mt-auto pt-4">
                <button onClick={onConnect} disabled={!!requestStatus} className={getButtonClasses()}>
                   {getButtonContent()}
                </button>
            </div>
        </div>
    );
};

const sendMessageToBuddy = async (senderId: string, receiverId: string, text: string) => {
    if (!text.trim() || !senderId || !receiverId) return;

    const conversationId = [senderId, receiverId].sort().join('-');
    const conversationRef = doc(db, "conversations", conversationId);
    const messagesColRef = collection(conversationRef, "messages");

    await addDoc(messagesColRef, {
        senderId: senderId,
        text: text,
        timestamp: Date.now(),
        conversationId,
    });
    
    await setDoc(conversationRef, { participants: [senderId, receiverId]}, { merge: true });
};

// --- PAGES ---

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, signup } = useAuth();
    const navigate = useNavigate();

    const [signupStep, setSignupStep] = useState(1);
    const [subjectsNeedHelp, setSubjectsNeedHelp] = useState<number[]>([]);
    const [subjectsCanHelp, setSubjectsCanHelp] = useState<number[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (isLogin) {
            try {
                await login(email, password);
                navigate('/');
            } catch (err: any) {
                setError(err.message || 'Failed to sign in.');
                setIsSubmitting(false);
            }
        } else {
            if (signupStep === 1) {
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    setIsSubmitting(false);
                    return;
                }
                setSignupStep(2);
                setIsSubmitting(false);
            } else {
                try {
                    await signup(email, username, password, { subjectsNeedHelp, subjectsCanHelp });
                    navigate('/');
                } catch (err: any) {
                    setError(err.message || "Failed to create account.");
                    setIsSubmitting(false);
                }
            }
        }
    };
    
    const handleSubjectSelect = (type: 'need' | 'can', subjectId: number) => {
        const updater = type === 'need' ? setSubjectsNeedHelp : setSubjectsCanHelp;
        updater(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
    };

    const toggleForm = () => {
      setIsLogin(!isLogin);
      setError('');
      setSignupStep(1);
    }

    const inputClasses = "appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-700 text-onBackground";

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <BookOpenIcon className="mx-auto h-12 w-auto text-primary" />
                <h2 className="mt-6 text-center text-3xl font-extrabold text-onBackground">
                    {isLogin ? 'Sign in to your account' : signupStep === 1 ? 'Create a new account' : `One last step, ${username}!`}
                </h2>
                {signupStep === 2 && <p className="mt-2 text-center text-sm text-onSurface">This helps us find your perfect study buddy.</p>}
            </div>
            <div className={`mt-8 sm:mx-auto sm:w-full ${signupStep === 1 ? 'sm:max-w-md' : 'sm:max-w-3xl'}`}>
                <div className="bg-surface py-8 px-4 shadow-2xl shadow-primary/10 sm:rounded-lg sm:px-10 border border-gray-700">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {signupStep === 1 ? (
                            <>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-onSurface">Username</label>
                                        <div className="mt-1"><input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} className={inputClasses}/></div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-onSurface">Email address</label>
                                    <div className="mt-1"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} /></div>
                                </div>
                                <div>
                                    <label htmlFor="password"  className="block text-sm font-medium text-onSurface">Password</label>
                                    <div className="mt-1"><input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClasses}/></div>
                                </div>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="confirm-password"  className="block text-sm font-medium text-onSurface">Confirm Password</label>
                                        <div className="mt-1"><input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClasses}/></div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-onBackground">Subjects I need help with:</h3>
                                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {ALL_SUBJECTS.map(subject => (
                                             <div key={`need-${subject.id}`} onClick={() => handleSubjectSelect('need', subject.id)}
                                                className={`flex items-center justify-center text-center space-x-2 p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${subjectsNeedHelp.includes(subject.id) ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 scale-105' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`}>
                                                <span>{subject.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-onBackground">Subjects I can help with:</h3>
                                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {ALL_SUBJECTS.map(subject => (
                                             <div key={`can-${subject.id}`} onClick={() => handleSubjectSelect('can', subject.id)}
                                                className={`flex items-center justify-center text-center space-x-2 p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${subjectsCanHelp.includes(subject.id) ? 'bg-green-500/20 border-green-400 text-green-300 scale-105' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`}>
                                                <span>{subject.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             </div>
                        )}
                        {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
                        <div>
                            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all duration-200 transform active:scale-95 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                {isSubmitting ? 'Processing...' : (isLogin ? 'Sign in' : (signupStep === 1 ? 'Continue' : 'Finish & Find Buddies!'))}
                            </button>
                        </div>
                    </form>
                     {signupStep === 1 && (
                         <div className="mt-6">
                            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-onSurface">Or</span></div></div>
                            <div className="mt-6"><button onClick={toggleForm} className="w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-surface text-sm font-medium text-onSurface hover:bg-gray-700 transition-colors">
                                {isLogin ? 'Create an account' : 'Sign in instead'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProfilePage: React.FC = () => {
    const { currentUser, currentUserProfile, updateProfile } = useAuth();
    const [formData, setFormData] = useState<StudentProfile | null>(currentUserProfile);
    const [isSaved, setIsSaved] = useState(false);
    
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [bioError, setBioError] = useState<string | null>(null);


    useEffect(() => {
        setFormData(currentUserProfile);
    }, [currentUserProfile]);

    if (!formData || !currentUser) {
        return <div className="container mx-auto p-4 sm:p-8 animate-fadeIn"><p>Loading profile...</p></div>
    }
    
    const handleGenerateBio = async () => {
        if (!currentUserProfile || !formData) return;
        setIsGeneratingBio(true);
        setBioError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const subjectsCanHelpStr = formData.subjectsCanHelp.map(getSubjectName).join(', ');
            const subjectsNeedHelpStr = formData.subjectsNeedHelp.map(getSubjectName).join(', ');
            const learningStyle = formData.learningStyle;

            const prompt = `Write a friendly and engaging user bio for a study app. The user's details are:
            - Learning Style: ${learningStyle}
            - Subjects they can help with: ${subjectsCanHelpStr || 'None'}
            - Subjects they need help with: ${subjectsNeedHelpStr || 'None'}
            Keep it concise (2-3 sentences) and encouraging. Write it in the first person.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setFormData({ ...formData, bio: response.text });
        } catch (error) {
            console.error("AI Bio generation failed. This is likely an API key or configuration issue.", error);
            setBioError("Failed to generate bio. The AI service may not be configured correctly.");
        } finally {
            setIsGeneratingBio(false);
        }
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleImageUpload = async () => {
        if (!imageFile) return;
        setUploadProgress(0);
        setUploadError(null);

        const storageRef = ref(storage, `profile-pictures/${currentUser.uid}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                setUploadError("Upload failed. Please try again.");
                setUploadProgress(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { photoURL: downloadURL });
                setUploadProgress(100);
                setTimeout(() => {
                    setUploadProgress(null);
                    setImageFile(null);
                    setImagePreview(null);
                }, 2000);
            }
        );
    };

    const handleMultiSelect = (field: 'subjectsNeedHelp' | 'subjectsCanHelp' | 'preferredMethods' | 'availability', value: any) => {
        const currentValues = formData[field] as any[];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
        setFormData({ ...formData, [field]: newValues });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateProfile(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const choiceBoxClasses = (isSelected: boolean, color: 'primary' | 'yellow' | 'green') => {
        const base = "flex items-center justify-center text-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2";
        if (isSelected) {
            const colors = {
                primary: 'bg-primary/20 border-primary text-indigo-300 scale-105',
                yellow: 'bg-yellow-500/20 border-yellow-400 text-yellow-300 scale-105',
                green: 'bg-green-500/20 border-green-400 text-green-300 scale-105',
            };
            return `${base} ${colors[color]}`;
        }
        return `${base} bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 hover:border-gray-500`;
    };

    return (
        <div className="container mx-auto p-4 sm:p-8 animate-fadeIn">
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-onBackground">Edit Your Profile</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-surface p-6 rounded-lg shadow-lg text-center border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4 text-onBackground">Profile Picture</h2>
                        <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                            <Avatar user={{...currentUser, photoURL: imagePreview || currentUser.photoURL}} className="w-full h-full text-5xl" />
                        </div>
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="mt-4 w-full px-4 py-2 bg-gray-600 text-onBackground font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                            Change Picture
                        </button>
                        {imageFile && (
                            <div className="mt-4">
                                {uploadProgress === null ? (
                                     <button onClick={handleImageUpload} className="w-full px-4 py-2 bg-secondary text-white font-semibold rounded-lg hover:bg-teal-500 transition-colors">
                                        Save Picture
                                    </button>
                                ) : (
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                )}
                                {uploadError && <p className="text-danger text-sm mt-2">{uploadError}</p>}
                                {uploadProgress === 100 && <p className="text-green-400 text-sm mt-2">Upload complete!</p>}
                            </div>
                        )}
                         {formData.badges && formData.badges.length > 0 && (
                            <div className="mt-6 text-left">
                                <h3 className="text-lg font-semibold mb-2 text-center text-onBackground">My Achievements</h3>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {formData.badges.map(badge => (
                                        <div key={badge} className="flex items-center gap-2 p-2 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/50">
                                            <TrophyIcon className="w-5 h-5" />
                                            <span className="font-semibold">{badge}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="bg-surface p-6 sm:p-8 rounded-lg shadow-lg space-y-8 border border-gray-700">
                        <div>
                            <label className="text-lg font-semibold flex justify-between items-center text-onBackground">
                                <span>About Me</span>
                                <button type="button" onClick={handleGenerateBio} disabled={isGeneratingBio} className="flex items-center gap-1 text-sm text-primary font-semibold hover:text-indigo-400 disabled:opacity-50">
                                    <SparklesIcon className="w-4 h-4" />
                                    {isGeneratingBio ? 'Generating...' : 'Generate with AI'}
                                </button>
                            </label>
                            {bioError && <p className="text-sm text-danger mt-2">{bioError}</p>}
                            <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="mt-2 w-full p-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground" rows={3}></textarea>
                        </div>
                        
                        <div>
                            <h3 className="text-lg font-semibold text-onBackground">Subjects I Need Help With</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                {ALL_SUBJECTS.map(subject => (
                                    <div key={subject.id} onClick={() => handleMultiSelect('subjectsNeedHelp', subject.id)} className={choiceBoxClasses(formData.subjectsNeedHelp.includes(subject.id), 'yellow')}>
                                        <span>{subject.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-onBackground">Subjects I Can Help With</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                {ALL_SUBJECTS.map(subject => (
                                    <div key={subject.id} onClick={() => handleMultiSelect('subjectsCanHelp', subject.id)} className={choiceBoxClasses(formData.subjectsCanHelp.includes(subject.id), 'green')}>
                                        <span>{subject.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-onBackground">My Availability</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                {ALL_AVAILABILITY_OPTIONS.map(opt => (
                                    <div key={opt} onClick={() => handleMultiSelect('availability', opt)} className={choiceBoxClasses(formData.availability.includes(opt), 'primary')}>
                                        <span>{opt}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="text-lg font-semibold text-onBackground">Preferred Study Methods</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                {ALL_STUDY_METHODS.map(method => (
                                    <div key={method} onClick={() => handleMultiSelect('preferredMethods', method)} className={choiceBoxClasses(formData.preferredMethods.includes(method), 'primary')}>
                                        <span>{method}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-onBackground">Learning Style</h3>
                            <div className="flex flex-col md:flex-row gap-4 mt-2">
                                {ALL_LEARNING_STYLES.map(({style, description}) => (
                                    <label key={style} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${formData.learningStyle === style ? 'border-primary bg-primary/20 scale-105' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                                        <input type="radio" name="learningStyle" value={style} checked={formData.learningStyle === style} onChange={e => setFormData({...formData, learningStyle: e.target.value as LearningStyle})} className="sr-only"/>
                                        <span className="font-bold block text-onBackground">{style}</span>
                                        <span className="text-sm text-onSurface">{description}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button type="submit" className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">Save Profile</button>
                            {isSaved && <div className="flex items-center gap-2 text-green-400 animate-fadeIn"><CheckCircleIcon /><span>Profile saved!</span></div>}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const DiscoverPage: React.FC = () => {
    const { currentUser, currentUserProfile } = useAuth();
    const [allUsers, setAllUsers] = useState<{user: User, profile: StudentProfile}[]>([]);
    const [loading, setLoading] = useState(true);
    const [sentRequests, setSentRequests] = useState<StudyRequest[]>([]);
    const connections = useMemo(() => currentUser?.connections || [], [currentUser]);
    const [activeTab, setActiveTab] = useState('buddies');
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);


    useEffect(() => {
        if (!currentUser) return;

        const fetchUsers = async () => {
            setLoading(true);
            const usersQuery = query(collection(db, "users"), where("email", "!=", currentUser.email));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

            const profilesSnapshot = await getDocs(collection(db, "profiles"));
            const profilesData = new Map<string, StudentProfile>();
            profilesSnapshot.forEach(doc => {
                profilesData.set(doc.id, { userId: doc.id, ...doc.data()} as StudentProfile);
            });

            const combinedData = usersData
                .map(user => ({ user, profile: profilesData.get(user.uid)! }))
                .filter(item => item.profile); 

            setAllUsers(combinedData);
            setLoading(false);
        };
        
        const fetchGroups = async () => {
            setLoadingGroups(true);
            const groupsQuery = query(collection(db, "studyGroups"));
            const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
                const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyGroup));
                setGroups(groupsData);
                setLoadingGroups(false);
            });
            return unsubscribe;
        };

        fetchUsers();
        const groupUnsubscribe = fetchGroups();

        const requestsQuery = query(collection(db, "studyRequests"), where("fromUserId", "==", currentUser.uid));
        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRequest));
            setSentRequests(requests);
        });

        return () => {
            unsubscribe();
            if (typeof groupUnsubscribe === 'function') {
                groupUnsubscribe();
            }
        };
    }, [currentUser]);
    
    const getRequestStatus = (targetUserId: string) => {
        if (connections.includes(targetUserId)) return 'accepted';
        const request = sentRequests.find(r => r.toUserId === targetUserId);
        return request ? request.status : null;
    }

    const handleConnect = async (toUser: User) => {
        if (!currentUser || getRequestStatus(toUser.uid)) return;

        try {
            const newRequest: Omit<StudyRequest, 'id'> = {
                fromUserId: currentUser.uid,
                fromUsername: currentUser.username,
                toUserId: toUser.uid,
                toUsername: toUser.username,
                status: 'pending',
                createdAt: Date.now(),
            };
            await addDoc(collection(db, "studyRequests"), newRequest);
        } catch (error) {
            console.error("Error sending request: ", error);
            alert("Failed to send request.");
        }
    };
    
    const handleJoinGroup = async (group: StudyGroup) => {
        if (!currentUser) return;
        const groupRef = doc(db, "studyGroups", group.id);
        await updateDoc(groupRef, {
            memberIds: arrayUnion(currentUser.uid)
        });
    };

    const handleCreateGroup = async (name: string, description: string, subjectId: number) => {
        if(!currentUser) return;
        const subject = ALL_SUBJECTS.find(s => s.id === subjectId);
        if(!subject) return;

        await addDoc(collection(db, "studyGroups"), {
            name,
            description,
            subjectId,
            subjectName: subject.name,
            creatorId: currentUser.uid,
            memberIds: [currentUser.uid],
        });
        setCreateModalOpen(false);
    }
    
    if (!currentUserProfile || (currentUserProfile.subjectsCanHelp.length === 0 && currentUserProfile.subjectsNeedHelp.length === 0)) {
        return <div className="container mx-auto p-8 text-center animate-fadeIn">
            <p className="text-lg text-onSurface">Please complete your profile first to discover other students.</p>
            <Link to="/profile" className="mt-4 inline-block bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 transition">Go to Profile</Link>
        </div>;
    }

    const calculateMatchScore = (otherProfile: StudentProfile) => {
        let score = 0;
        if (!currentUserProfile) return 0;
        const needsMet = currentUserProfile.subjectsNeedHelp.filter(s => otherProfile.subjectsCanHelp.includes(s)).length;
        const canHelpMet = currentUserProfile.subjectsCanHelp.filter(s => otherProfile.subjectsNeedHelp.includes(s)).length;
        score += (needsMet + canHelpMet) * 20;

        const availabilityOverlap = currentUserProfile.availability.filter(a => otherProfile.availability.includes(a)).length;
        score += availabilityOverlap * 10;
        
        if(currentUserProfile.learningStyle === otherProfile.learningStyle) score += 15;
        const methodOverlap = currentUserProfile.preferredMethods.filter(m => otherProfile.preferredMethods.includes(m)).length;
        score += methodOverlap * 5;
        
        return score;
    };
    
    const potentialMatches = allUsers
        .map(u => ({
            ...u,
            score: calculateMatchScore(u.profile)
        }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);

    const GroupCard: React.FC<{group: StudyGroup}> = ({ group }) => (
        <div className="bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:shadow-secondary/20 border border-transparent hover:border-secondary/50">
            <div>
                <h3 className="text-xl font-bold text-secondary">{group.name}</h3>
                <span className="bg-teal-500/20 text-teal-300 text-sm font-medium px-2.5 py-0.5 rounded-full">{group.subjectName}</span>
            </div>
            <p className="text-onSurface flex-grow">{group.description}</p>
            <div className="flex items-center text-sm text-gray-400">
                <UsersIcon className="w-4 h-4 mr-2"/>
                {group.memberIds.length} member(s)
            </div>
            <div className="mt-auto pt-4">
                {group.memberIds.includes(currentUser!.uid) ? (
                     <button disabled className="w-full font-bold py-3 px-4 rounded-lg bg-green-500 text-white cursor-default flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5"/> Joined
                     </button>
                ) : (
                    <button onClick={() => handleJoinGroup(group)} className="w-full font-bold py-3 px-4 rounded-lg bg-secondary text-onSecondary hover:bg-teal-500 transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 hover:shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                        <PlusCircleIcon className="w-5 h-5"/> Join Group
                    </button>
                )}
            </div>
        </div>
    );
    
    const CreateGroupModal: React.FC<{isOpen: boolean, onClose: () => void, onCreate: (name: string, description: string, subjectId: number) => void}> = ({isOpen, onClose, onCreate}) => {
        const [name, setName] = useState('');
        const [description, setDescription] = useState('');
        const [subjectId, setSubjectId] = useState<number | null>(null);

        if(!isOpen) return null;

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if(name && description && subjectId) {
                onCreate(name, description, subjectId);
            }
        };

        const inputClasses = "w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-primary focus:border-primary";

        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-surface rounded-lg p-8 shadow-2xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold mb-4 text-onBackground">Create a New Study Group</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block font-semibold text-onSurface">Group Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                        </div>
                         <div>
                            <label className="block font-semibold text-onSurface">Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required className={inputClasses} rows={3}></textarea>
                        </div>
                        <div>
                            <label className="block font-semibold text-onSurface">Subject</label>
                            <select onChange={e => setSubjectId(Number(e.target.value))} required className={inputClasses} defaultValue="">
                                <option value="" disabled>Select a subject</option>
                                {ALL_SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-indigo-500 transition">Create</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    };
    
    return (
        <div className="container mx-auto p-4 sm:p-8 animate-fadeIn">
             <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreateGroup} />
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                 <h1 className="text-3xl sm:text-4xl font-bold">Discover</h1>
                 {activeTab === 'groups' && (
                     <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        <PlusCircleIcon className="w-5 h-5" />
                        Create Group
                     </button>
                 )}
             </div>

             <div className="flex border-b border-gray-700 mb-6">
                <button onClick={() => setActiveTab('buddies')} className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'buddies' ? 'border-b-2 border-primary text-primary' : 'text-onSurface'}`}>Buddies</button>
                <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'groups' ? 'border-b-2 border-primary text-primary' : 'text-onSurface'}`}>Groups</button>
             </div>

             {activeTab === 'buddies' ? (
                loading ? <p>Finding potential buddies...</p> :
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {potentialMatches.map(({ user, profile }, index) => (
                        <UserCard 
                            key={user.uid} 
                            user={user} 
                            profile={profile} 
                            onConnect={() => handleConnect(user)}
                            requestStatus={getRequestStatus(user.uid)}
                            style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                            className="animate-fadeIn"
                        />
                    ))}
                    {potentialMatches.length === 0 && <p className="text-center text-onSurface col-span-full">No matches found. Try broadening your profile criteria!</p>}
                </div>
             ) : (
                loadingGroups ? <p>Loading groups...</p> :
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {groups.map(group => <GroupCard key={group.id} group={group} />)}
                   {groups.length === 0 && <p className="text-center text-onSurface col-span-full">No groups found. Why not create one?</p>}
                </div>
             )}
        </div>
    );
};

const HomePage: React.FC = () => {
    const { currentUser, currentUserProfile } = useAuth();
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

    const userSubjects = useMemo(() => {
        if (!currentUserProfile) return [];
        const subjectIds = [...new Set([...currentUserProfile.subjectsNeedHelp, ...currentUserProfile.subjectsCanHelp])];
        return ALL_SUBJECTS.filter(s => subjectIds.includes(s.id));
    }, [currentUserProfile]);

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
                const currentUserRef = doc(db, "users", currentUser.uid);
                const otherUserRef = doc(db, "users", request.fromUserId);

                await updateDoc(currentUserRef, { connections: arrayUnion(request.fromUserId) });
                await updateDoc(otherUserRef, { connections: arrayUnion(currentUser.uid) });
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const subjectName = getSubjectName(selectedSubjectId);
            const prompt = `Create a concise, one-week study plan for the subject "${subjectName}". Break it down into daily tasks. The plan should be encouraging and easy to follow. Use markdown for formatting with headings for each day.`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            // FIX: The AI response text is a property, not a method.
            // The error "This expression is not callable" suggests text() was being called.
            setStudyPlan(response.text);
        } catch (error) {
            console.error("AI Study Plan generation failed. This is likely an API key or configuration issue.", error);
            setStudyPlan("Sorry, there was an issue connecting to the AI service. This feature may not be configured correctly. Please try again later.");
        } finally {
            setIsGeneratingPlan(false);
        }
    };
    
    const handleSendPlan = async () => {
        if (!studyPlan || !selectedBuddyToSend || !currentUser) return;
        
        const subjectName = getSubjectName(selectedSubjectId!);
        const planToSend = `Hey! Here's a study plan I generated for ${subjectName}:\n\n${studyPlan}`;

        await sendMessageToBuddy(currentUser.uid, selectedBuddyToSend, planToSend);
        setSendSuccessMessage(`Plan sent to ${buddies.find(b => b.uid === selectedBuddyToSend)?.username}!`);
        setTimeout(() => setSendSuccessMessage(''), 3000);
    };
    
    const inputClasses = "w-full sm:w-auto flex-grow p-2 border border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-surface text-onBackground";

    return (
        <div className="container mx-auto p-4 sm:p-8 animate-fadeIn">
             <h1 className="text-3xl sm:text-4xl font-bold text-onBackground">Dashboard</h1>
             <p className="mt-2 text-lg text-onSurface">Here's your study overview.</p>
             <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                    <Link to="/messages" state={{ selectedBuddyId: buddy.uid }} className="text-sm text-primary hover:underline font-semibold">Message</Link>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">No active buddies yet. <Link to="/discover" className="text-primary hover:underline">Find a partner</Link> to get started!</p> )}
                </div>
                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-onBackground"><ChatBubbleIcon/> Pending Requests</h2>
                    {loadingRequests ? ( <p className="mt-4 text-onSurface">Loading requests...</p> ) : 
                    incomingRequests.length > 0 ? (
                        <ul className="mt-4 space-y-3">
                            {incomingRequests.map(req => (
                                <li key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-background rounded-md border border-gray-700 gap-2">
                                    <span className="text-onSurface text-sm">Request from <span className="font-bold text-onBackground">{req.fromUsername}</span></span>
                                    <div className="flex gap-2 self-end sm:self-center">
                                        <button onClick={() => handleRequestResponse(req, 'accepted')} className="p-1 text-green-400 hover:bg-green-500/20 rounded-full transition-colors transform hover:scale-125" title="Accept"><CheckCircleIcon className="w-6 h-6" /></button>
                                        <button onClick={() => handleRequestResponse(req, 'declined')} className="p-1 text-red-400 hover:bg-red-500/20 rounded-full transition-colors transform hover:scale-125" title="Decline"><XCircleIcon className="w-6 h-6" /></button>
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
                        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myGroups.map(group => (
                                <Link to={`/group/${group.id}`} key={group.id} className="block p-4 bg-background rounded-lg transition hover:bg-gray-800 hover:shadow-md border border-gray-700 hover:border-primary/50">
                                    <h3 className="font-bold text-primary">{group.name}</h3>
                                    <p className="text-sm text-onSurface">{group.subjectName}</p>
                                    <p className="text-xs text-gray-400 mt-2">{group.memberIds.length} members</p>
                                </Link>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-onSurface">You haven't joined any groups yet. <Link to="/discover" className="text-primary hover:underline">Find a group</Link> to collaborate!</p>
                    )}
                </div>

                <div className="bg-surface/50 border border-gray-700 p-6 rounded-lg shadow-lg lg:col-span-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-primary"><SparklesIcon /> AI Study Planner</h2>
                    <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <select
                            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                            className={inputClasses}
                            defaultValue=""
                        >
                            <option value="" disabled>Select a subject...</option>
                            {userSubjects.map(subject => (
                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                        </select>
                        <button onClick={handleGeneratePlan} disabled={!selectedSubjectId || isGeneratingPlan} className="w-full sm:w-auto px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition transform active:scale-95 disabled:bg-gray-600 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            {isGeneratingPlan ? 'Generating...' : 'Generate Plan'}
                        </button>
                    </div>

                    {isGeneratingPlan && <div className="mt-4 text-center text-onSurface">Generating your study plan...</div>}

                    {studyPlan && (
                        <div className="mt-6 p-4 bg-indigo-500/10 rounded-lg animate-fadeIn border border-indigo-500/30">
                            <h3 className="text-lg font-bold mb-2 text-onBackground">Your {getSubjectName(selectedSubjectId!)} Study Plan:</h3>
                            <div className="whitespace-pre-wrap text-onSurface prose prose-invert max-w-none">{studyPlan}</div>
                            
                            {buddies.length > 0 && studyPlan.startsWith("Sorry,") === false && (
                                <div className="mt-6 pt-4 border-t border-indigo-500/30">
                                    <h4 className="font-semibold text-onBackground">Share with a buddy:</h4>
                                    <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                        <select onChange={(e) => setSelectedBuddyToSend(e.target.value)} value={selectedBuddyToSend} className={inputClasses}>
                                            {buddies.map(buddy => <option key={buddy.uid} value={buddy.uid}>{buddy.username}</option>)}
                                        </select>
                                        <button onClick={handleSendPlan} className="w-full sm:w-auto px-6 py-2 bg-secondary text-white font-semibold rounded-lg hover:bg-teal-500 transition transform active:scale-95 hover:shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                                            Send to Buddy
                                        </button>
                                    </div>
                                    {sendSuccessMessage && <p className="mt-2 text-sm text-green-400 animate-fadeIn">{sendSuccessMessage}</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};

const MessagesPage: React.FC = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [buddies, setBuddies] = useState<User[]>([]);
    const [selectedBuddy, setSelectedBuddy] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isChallengeModalOpen, setChallengeModalOpen] = useState(false);


    useEffect(() => {
        if (!currentUser?.connections) {
            setBuddies([]);
            return;
        };

        const fetchBuddies = async () => {
            if (currentUser.connections.length === 0) {
                setBuddies([]);
                return;
            }
            const buddyPromises = currentUser.connections.map(uid => getDoc(doc(db, "users", uid)));
            const buddyDocs = await Promise.all(buddyPromises);
            const buddyData = buddyDocs
                .filter(d => d.exists())
                .map(doc => ({ uid: doc.id, ...doc.data() }) as User);
            
            setBuddies(buddyData);
            
            if (buddyData.length > 0) {
                const initialBuddyId = location.state?.selectedBuddyId;
                const buddyToSelect = initialBuddyId ? buddyData.find(b => b.uid === initialBuddyId) : buddyData[0];
                
                if (buddyToSelect) {
                    setSelectedBuddy(buddyToSelect);
                } else if (!selectedBuddy) {
                    setSelectedBuddy(buddyData[0]);
                }
                
                if (initialBuddyId) {
                    navigate(location.pathname, { replace: true, state: {} });
                }
            } else {
                 setSelectedBuddy(null);
            }
        };
        fetchBuddies();
    }, [currentUser?.connections, location.state]);

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
        if (!newMessage.trim() || !currentUser || !selectedBuddy) return;
        await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, newMessage);
        setNewMessage('');
    };
    
    const handleSummarize = async () => {
        if (messages.length < 5) {
            alert("Not enough messages to summarize.");
            return;
        }
        setIsSummarizing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const conversationText = messages.map(m => `${buddies.find(b => b.uid === m.senderId)?.username || 'User'}: ${m.text}`).join('\n');
            const prompt = `Summarize the key points of the following conversation between two students:\n\n${conversationText}`;
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            
            setNewMessage(`Summary of our recent chat:\n- ${response.text.replace(/\*/g, '').split('\n').join('\n- ')}`);
        } catch (error) {
            console.error("Chat summarization failed:", error);
            alert("Could not summarize the chat. The AI service may be unavailable.");
        } finally {
            setIsSummarizing(false);
        }
    };
    
    const handleSendChallenge = async (subjectId: number) => {
        if (!currentUser || !selectedBuddy) return;
        const subjectName = getSubjectName(subjectId);
        const challengeText = `${currentUser.username} challenged you to a ${subjectName} quiz! Winner gets bragging rights.`;
        await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, challengeText);
        setChallengeModalOpen(false);
    };
    
    const ChallengeModal: React.FC = () => (
         <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={() => setChallengeModalOpen(false)}>
            <div className="bg-surface rounded-lg p-6 shadow-2xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-onBackground">Challenge {selectedBuddy?.username}</h2>
                <p className="text-onSurface mb-4">Select a subject for the quiz challenge:</p>
                <div className="grid grid-cols-2 gap-3">
                    {ALL_SUBJECTS.map(s => (
                        <button key={s.id} onClick={() => handleSendChallenge(s.id)} className="p-3 bg-primary/20 text-primary rounded-md hover:bg-primary/40 transition-colors font-semibold">
                            {s.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-4 sm:p-8 animate-fadeIn">
            {isChallengeModalOpen && <ChallengeModal />}
            <h1 className="text-3xl font-bold mb-6 hidden sm:block">Messages</h1>
            <div className="flex flex-col md:flex-row bg-surface shadow-lg rounded-lg h-[85vh] sm:h-[75vh] border border-gray-700">
                {/* Buddies List */}
                <div className={`w-full md:w-1/3 border-r border-gray-700 flex-col ${selectedBuddy ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="text-xl font-semibold text-onBackground">Contacts</h2>
                    </div>
                    <ul className="overflow-y-auto">
                        {buddies.map(buddy => (
                            <li key={buddy.uid} onClick={() => setSelectedBuddy(buddy)} className={`p-4 flex items-center gap-3 cursor-pointer transition-colors duration-200 hover:bg-gray-800 ${selectedBuddy?.uid === buddy.uid ? 'bg-primary/20' : ''}`}>
                                <Avatar user={buddy} className="w-12 h-12" />
                                <div>
                                    <p className="font-semibold text-onBackground">{buddy.username}</p>
                                </div>
                            </li>
                        ))}
                         {buddies.length === 0 && <p className="p-4 text-onSurface">No buddies yet.</p>}
                    </ul>
                </div>

                {/* Chat Window */}
                <div className={`w-full md:w-2/3 flex-col ${selectedBuddy ? 'flex' : 'hidden md:flex'}`}>
                    {selectedBuddy ? (
                        <>
                            <div className="p-3 border-b border-gray-700 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                   <button onClick={() => setSelectedBuddy(null)} className="md:hidden p-2 rounded-full hover:bg-surface"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                   <Avatar user={selectedBuddy} className="w-10 h-10" />
                                   <h2 className="text-lg font-semibold text-onBackground">{selectedBuddy.username}</h2>
                                </div>
                                <button onClick={handleSummarize} disabled={isSummarizing} className="p-2 rounded-full hover:bg-primary/20 text-primary transition-colors disabled:opacity-50" title="Summarize Chat">
                                   <SparklesIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto bg-background">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex mb-4 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${msg.senderId === currentUser?.uid ? 'bg-primary text-white' : 'bg-gray-700 text-onBackground'}`}>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-700 flex gap-2 bg-surface">
                                <button type="button" onClick={() => setChallengeModalOpen(true)} className="p-2 rounded-full hover:bg-primary/20 text-primary" title="Quiz Challenge"><SparklesIcon /></button>
                                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"/>
                                <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500 transition transform active:scale-95">Send</button>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 items-center justify-center text-onSurface hidden md:flex">
                            <p>Select a buddy to start chatting.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const GroupPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { id } = useParams();
    const [group, setGroup] = useState<StudyGroup | null>(null);
    const [members, setMembers] = useState<User[]>([]);
    const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);
    const [loading, setLoading] = useState(true);
    const scratchpadUpdateTimeout = useRef<number | null>(null);
    const [activeTab, setActiveTab] = useState('notes');
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    
    const contentDocRef = useMemo(() => doc(db, "studyGroups", id!, "content", "shared"), [id]);
    
    useEffect(() => {
        if (!id) return;
        setLoading(true);

        const groupDocRef = doc(db, "studyGroups", id);
        const unsubGroup = onSnapshot(groupDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const groupData = { id: docSnap.id, ...docSnap.data() } as StudyGroup;
                setGroup(groupData);
            } else {
                setGroup(null);
            }
        });
        
        const unsubContent = onSnapshot(contentDocRef, (docSnap) => {
            if(docSnap.exists()){
                setSharedContent(docSnap.data() as SharedContent);
            } else {
                const initialContent: SharedContent = { groupId: id, scratchpad: "## Shared Notes\n\n- Let's start!", whiteboardData: [], quizzes: [], quizAttempts: {}};
                setDoc(contentDocRef, initialContent);
                setSharedContent(initialContent);
            }
            setLoading(false);
        });

        return () => { unsubGroup(); unsubContent(); };
    }, [id, contentDocRef]);
    
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
    
    const handleScratchpadChange = (newText: string) => {
        setSharedContent(prev => prev ? ({ ...prev, scratchpad: newText }) : null);
        if (scratchpadUpdateTimeout.current) clearTimeout(scratchpadUpdateTimeout.current);
        scratchpadUpdateTimeout.current = window.setTimeout(async () => {
            await updateDoc(contentDocRef, { scratchpad: newText });
        }, 500);
    };

    const handleWhiteboardDraw = async (newData: any) => {
        setSharedContent(prev => prev ? ({ ...prev, whiteboardData: newData }) : null);
        await updateDoc(contentDocRef, { whiteboardData: newData });
    };
    
    const handleGenerateQuiz = async () => {
        if (!group || !currentUser) return;
        setIsGeneratingQuiz(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Generate a 5-question multiple-choice quiz about ${group.subjectName}. For each question, provide 4 options and clearly indicate the correct answer.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            quiz: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        question: { type: Type.STRING },
                                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        correctAnswer: { type: Type.STRING }
                                    },
                                     required: ["question", "options", "correctAnswer"]
                                }
                            }
                        }
                    }
                }
            });
            
            const quizData = JSON.parse(response.text);
            const newQuiz: Quiz = {
                id: `quiz_${Date.now()}`,
                title: `${group.subjectName} Quiz`,
                subject: group.subjectName,
                questions: quizData.quiz,
                createdBy: currentUser.uid,
                createdAt: Date.now()
            };

            await updateDoc(contentDocRef, { quizzes: arrayUnion(newQuiz) });
            setActiveTab('quiz');
        } catch (error) {
            console.error("Quiz generation failed:", error);
            alert("Failed to generate quiz. The AI service may be unavailable or returned an unexpected format.");
        } finally {
            setIsGeneratingQuiz(false);
        }
    };
    
    const handleQuizSubmit = async (quiz: Quiz, score: number) => {
        if (!currentUser) return;
        const newAttempt: UserQuizAttempt = {
            userId: currentUser.uid,
            username: currentUser.username,
            score,
            total: quiz.questions.length,
            timestamp: Date.now()
        };
        const currentAttempts = sharedContent?.quizAttempts?.[quiz.id] || [];
        const updatedAttempts = [...currentAttempts.filter(a => a.userId !== currentUser.uid), newAttempt];
        
        await updateDoc(contentDocRef, { [`quizAttempts.${quiz.id}`]: updatedAttempts });
    };

    if (loading) return <LoadingSpinner />;
    if (!group || !sharedContent) return <div className="container mx-auto p-8 animate-fadeIn text-center"><h1 className="text-2xl">Group not found.</h1></div>
    
    const QuizComponent: React.FC<{ quiz: Quiz; onSubmit: (score: number) => void; attempts: UserQuizAttempt[] }> = ({ quiz, onSubmit, attempts }) => {
        const [answers, setAnswers] = useState<{[key: number]: string}>({});
        const [submitted, setSubmitted] = useState(false);
        const myAttempt = attempts.find(a => a.userId === currentUser?.uid);

        const handleSubmit = () => {
            const score = quiz.questions.reduce((count, q, index) => {
                return answers[index] === q.correctAnswer ? count + 1 : count;
            }, 0);
            onSubmit(score);
            setSubmitted(true);
        };

        if (myAttempt || submitted) {
            return (
                <div className="bg-surface p-4 rounded-lg">
                    <h3 className="font-bold text-lg">Your Score: {myAttempt?.score}/{myAttempt?.total}</h3>
                    <p className="text-onSurface">You've completed this quiz!</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {quiz.questions.map((q, i) => (
                    <div key={i}>
                        <p className="font-semibold">{i + 1}. {q.question}</p>
                        <div className="mt-2 space-y-2">
                            {q.options.map(opt => (
                                <label key={opt} className={`block p-3 rounded-lg cursor-pointer ${answers[i] === opt ? 'bg-primary/30' : 'bg-gray-700/50'}`}>
                                    <input type="radio" name={`q-${i}`} value={opt} onChange={(e) => setAnswers({...answers, [i]: e.target.value})} className="mr-2"/>
                                    {opt}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
                <button onClick={handleSubmit} className="w-full px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-500">Submit Quiz</button>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 sm:p-8 animate-fadeIn">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-onBackground">{group.name}</h1>
            <p className="text-onSurface mb-6">{group.description}</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2">
                    <div className="flex border-b border-gray-700 mb-4">
                        <button onClick={() => setActiveTab('notes')} className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'notes' ? 'border-b-2 border-primary text-primary' : 'text-onSurface'}`}>Notes & Board</button>
                        <button onClick={() => setActiveTab('quiz')} className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'quiz' ? 'border-b-2 border-primary text-primary' : 'text-onSurface'}`}>Shared Quiz</button>
                    </div>

                    {activeTab === 'notes' && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div>
                                <h2 className="text-2xl font-semibold mb-4 text-onBackground">Shared Scratchpad</h2>
                                <textarea 
                                    className="w-full h-96 p-4 border border-gray-600 rounded-lg shadow-inner font-mono text-sm bg-surface text-onBackground focus:ring-primary focus:border-primary"
                                    value={sharedContent.scratchpad}
                                    onChange={(e) => handleScratchpadChange(e.target.value)}
                                />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold mb-4 text-onBackground">Shared Whiteboard</h2>
                                <Whiteboard width={500} height={400} onDraw={handleWhiteboardDraw} initialData={sharedContent.whiteboardData}/>
                            </div>
                        </div>
                    )}
                    {activeTab === 'quiz' && (
                         <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-semibold text-onBackground">Quizzes</h2>
                                <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz} className="flex items-center gap-2 px-4 py-2 bg-secondary text-white font-semibold rounded-lg hover:bg-teal-500 transition disabled:opacity-50">
                                    <SparklesIcon className="w-5 h-5"/>
                                    {isGeneratingQuiz ? "Generating..." : "Generate Quiz with AI"}
                                </button>
                            </div>
                            
                            {sharedContent.quizzes && sharedContent.quizzes.length > 0 ? (
                                <div className="space-y-4">
                                {sharedContent.quizzes.map(quiz => (
                                    <div key={quiz.id} className="bg-surface p-4 rounded-lg border border-gray-700">
                                        <details className="group">
                                            <summary className="font-bold text-lg cursor-pointer flex justify-between items-center">
                                                {quiz.title} - {quiz.questions.length} questions
                                                <span className="group-open:rotate-90 transition-transform">▶</span>
                                            </summary>
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <QuizComponent quiz={quiz} attempts={sharedContent.quizAttempts?.[quiz.id] || []} onSubmit={(score) => handleQuizSubmit(quiz, score)} />
                                                <div>
                                                    <h4 className="font-bold mb-2">Scoreboard</h4>
                                                    <ul className="space-y-2">
                                                        {(sharedContent.quizAttempts?.[quiz.id] || []).sort((a,b) => b.score - a.score).map(att => (
                                                            <li key={att.userId} className="flex justify-between p-2 bg-background rounded">
                                                                <span>{att.username}</span>
                                                                <span className="font-semibold">{att.score} / {att.total}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-onSurface text-center py-8">No quizzes yet. Generate one to get started!</p>
                            )}
                         </div>
                    )}
                </div>
                <div className="lg:col-span-1 bg-surface p-6 rounded-lg shadow-md border border-gray-700 h-fit">
                     <h2 className="text-2xl font-semibold mb-4 text-onBackground">Members ({members.length})</h2>
                     <ul className="space-y-3">
                        {members.map(member => (
                            <li key={member.uid} className="flex items-center gap-3">
                                <Avatar user={member} className="w-10 h-10" />
                                <span className="font-semibold text-onBackground">{member.username}</span>
                            </li>
                        ))}
                     </ul>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    return (
        <AuthProvider>
            <HashRouter>
                <MainApp />
            </HashRouter>
        </AuthProvider>
    );
};

const MainApp: React.FC = () => {
    const { currentUser } = useAuth();
    return (
        <div className="min-h-screen bg-background">
            {currentUser && <Header />}
            <main className="pb-16 md:pb-0">
                <Routes>
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                    <Route path="/group/:id" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to={currentUser ? "/" : "/auth"} />} />
                </Routes>
            </main>
        </div>
    );
};

export default App;