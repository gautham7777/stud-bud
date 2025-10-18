

import React, { useState, useContext, createContext, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, Link, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { User, StudentProfile, StudyGroup, Message, SharedContent, StudyRequest, Subject, LearningStyle, StudyMethod, Quiz, Question, StudyPost, QuizAttempt, StudyMaterial, UserMark } from './types';
import { ALL_SUBJECTS, ALL_AVAILABILITY_OPTIONS, ALL_LEARNING_STYLES, ALL_STUDY_METHODS } from './constants';
import { BookOpenIcon, UsersIcon, ChatBubbleIcon, UserCircleIcon, LogoutIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, SearchIcon, SparklesIcon, PencilIcon, TrashIcon, ChevronDownIcon, EraserIcon, ClipboardListIcon, ShieldCheckIcon, PaperClipIcon } from './components/icons';
import Whiteboard from './components/Whiteboard';

import { auth, db, storage } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where, addDoc, onSnapshot, arrayUnion, Timestamp, orderBy, serverTimestamp, deleteDoc, writeBatch, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI, Type } from "@google/genai";

// --- HELPERS ---
const sanitizeProfile = (data: any, userId: string): StudentProfile => ({
    userId: data.userId || userId,
    bio: data.bio || '',
    learningStyle: data.learningStyle || LearningStyle.Visual,
    preferredMethods: data.preferredMethods || [],
    availability: data.availability || [],
    badges: data.badges || [],
    quizWins: data.quizWins || 0,
});

const sanitizeGroup = (data: any, id: string): StudyGroup => ({
    id: data.id || id,
    name: data.name || 'Unnamed Group',
    description: data.description || '',
    creatorId: data.creatorId || '',
    subjectId: data.subjectId || 0,
    subjectName: data.subjectName || 'Unknown',
    memberIds: data.memberIds || [],
});


// --- AUTH CONTEXT ---
interface AuthContextType {
    currentUser: User | null;
    currentUserProfile: StudentProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
    signup: (email: string, username: string, pass: string) => Promise<void>;
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
                        setCurrentUserProfile(sanitizeProfile(docSnap.data(), firebaseUser.uid));
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

    const signup = async (email: string, username: string, pass: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const firebaseUser = userCredential.user;

        await setDoc(doc(db, "users", firebaseUser.uid), {uid: firebaseUser.uid, email, username, connections: [], photoURL: null});
        
        const newProfile: StudentProfile = {
            userId: firebaseUser.uid,
            bio: '',
            learningStyle: LearningStyle.Visual,
            preferredMethods: [],
            availability: [],
            badges: [],
            quizWins: 0,
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
        
        const finalProfile = { ...newProfileData, badges: allBadges };
        
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

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ isOpen, onClose, children, className = 'max-w-lg' }) => {
  if (!isOpen) return null;

  // Use a portal to render the modal at the root of the document,
  // avoiding issues with parent transforms (like page transitions).
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-surface rounded-lg p-6 shadow-2xl w-full border border-gray-700 animate-scaleIn relative ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-onSurface hover:text-danger transition-colors"
          aria-label="Close modal"
        >
          <XCircleIcon className="w-8 h-8" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};

// --- CORE UI COMPONENTS ---
const Header: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/user/${searchQuery.trim()}`);
            setSearchQuery('');
        }
    };

    const navItems = [
        { path: '/', label: 'Dashboard', icon: BookOpenIcon },
        { path: '/groups', label: 'Groups', icon: UsersIcon },
        { path: '/requests', label: 'Requests', icon: ClipboardListIcon },
        { path: '/messages', label: 'Messages', icon: ChatBubbleIcon },
    ];
    
    const profileItem = { path: '/profile', label: 'Profile', icon: UserCircleIcon };

    if (!currentUser) return null;
    
    const mainNavLinks = navItems.map(item => (
        <Link
            key={item.path}
            to={item.path}
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-[260ms] text-sm ${location.pathname === item.path ? 'bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
        >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
        </Link>
    ));

    const profileNavLink = (
        <Link
            to={profileItem.path}
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-[260ms] text-sm ${location.pathname === profileItem.path ? 'bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
        >
            <Avatar user={currentUser} className="h-5 w-5" />
            <span>{profileItem.label}</span>
        </Link>
    );

    const mobileNavLinks = [...navItems, profileItem].map(item => (
         <Link
            key={item.path}
            to={item.path}
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${location.pathname === item.path ? 'bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
        >
            {item.label === 'Profile' ? <Avatar user={currentUser} className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
            <span>{item.label}</span>
        </Link>
    ));

    return (
        <header className="bg-surface/70 backdrop-blur-sm shadow-lg sticky top-0 z-20">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-2 text-primary font-bold text-xl transition-transform hover:scale-105">
                            <BookOpenIcon className="h-8 w-8" />
                            <span className="text-onBackground">StudyBuddy</span>
                        </Link>
                        <div className="hidden md:block ml-10">
                            <div className="flex items-baseline space-x-4">
                                {mainNavLinks}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4">
                        <form onSubmit={handleSearch} className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Find users..."
                                className="bg-gray-700/50 text-onBackground placeholder-gray-400 rounded-full py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-gray-700 transition-all w-32 focus:w-48"
                            />
                            <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <SearchIcon className="h-5 w-5 text-gray-400 hover:text-primary" />
                            </button>
                        </form>

                        <div className="hidden md:flex items-center gap-4">
                            {profileNavLink}
                            <button onClick={logout} className="p-2 rounded-full text-onSurface hover:text-primary hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors duration-[260ms]">
                                <LogoutIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md text-onSurface hover:text-onBackground hover:bg-surface/50">
                                {isMobileMenuOpen ? <XCircleIcon className="h-6 w-6" /> : <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>}
                            </button>
                        </div>
                    </div>
                </div>
                {isMobileMenuOpen && (
                    <div className="md:hidden animate-fadeInUp pb-3">
                        <div className="flex flex-col space-y-2 pt-2">
                            {mobileNavLinks}
                            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-onSurface hover:bg-surface/50 hover:text-onBackground">
                                <LogoutIcon className="h-5 w-5" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
};

const getSubjectName = (id: number) => ALL_SUBJECTS.find(s => s.id === id)?.name || 'Unknown';

const Badge: React.FC<{ badge: string }> = ({ badge }) => (
    <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/50">
        <CheckCircleIcon className="w-3 h-3" />
        {badge}
    </span>
);

const sendMessageToBuddy = async (senderId: string, receiverId: string, content: { text?: string, imageUrl?: string }) => {
    if ((!content.text || !content.text.trim()) && !content.imageUrl) return;
    if (!senderId || !receiverId) return;

    const conversationId = [senderId, receiverId].sort().join('-');
    const conversationRef = doc(db, "conversations", conversationId);
    const messagesColRef = collection(conversationRef, "messages");

    await addDoc(messagesColRef, {
        senderId,
        ...content,
        timestamp: Date.now(),
        conversationId,
    });
    
    await setDoc(conversationRef, { participants: [senderId, receiverId]}, { merge: true });
};

const MotionGraphicsBackground: React.FC = () => (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Shape 1: Larger, more opaque, slower animation */}
        <div 
            className="floating-shape bg-primary/20" 
            style={{ 
                width: '30rem', 
                height: '30rem', 
                top: '5%', 
                left: '5%', 
                animationDuration: '35s',
            }}
        />
        {/* Shape 2: Also larger and more opaque, different position and speed */}
        <div 
            className="floating-shape bg-secondary/20" 
            style={{ 
                width: '25rem', 
                height: '25rem', 
                top: '50%', 
                left: '70%', 
                animationDuration: '30s',
                animationDelay: '3s',
                transform: 'rotate(45deg)' // Initial rotation for variety
            }}
        />
        {/* Shape 3: Larger, more opaque, different color and speed */}
        <div 
            className="floating-shape bg-amber-500/10" 
            style={{ 
                width: '20rem', 
                height: '20rem', 
                top: '20%', 
                left: '50%', 
                animationDuration: '40s',
                animationDelay: '5s',
            }}
        />
        {/* Shape 4: Smaller, but still more visible, different animation */}
        <div 
            className="floating-shape bg-primary/10" 
            style={{ 
                width: '15rem', 
                height: '15rem', 
                top: '75%', 
                left: '15%', 
                animationDuration: '28s',
                animationDirection: 'reverse' // Reverse animation direction for variety
            }}
        />
    </div>
);


// --- PAGES ---
const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const { login, signup } = useAuth();
    const navigate = useNavigate();

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
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                setIsSubmitting(false);
                return;
            }
            try {
                await signup(email, username, password);
                navigate('/');
            } catch (err: any) {
                setError(err.message || "Failed to create account.");
                setIsSubmitting(false);
            }
        }
    };
    
    const toggleForm = () => {
      setIsLogin(!isLogin);
      setError('');
    }

    const inputClasses = "appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-700 text-onBackground";
    
    const whyUsPoints = [
      {
        icon: UsersIcon,
        title: "Find Your Perfect Match",
        description: "Our smart algorithm connects you with compatible study partners based on your subjects, learning style, and availability."
      },
      {
        icon: ChatBubbleIcon,
        title: "Collaborate Seamlessly",
        description: "Utilize shared whiteboards, notes, and in-app messaging to work together effectively, no matter where you are."
      },
      {
        icon: ClipboardListIcon,
        title: "Gamified Learning",
        description: "Challenge your group members with AI-generated quizzes and climb the leaderboard to become a subject champion."
      }
    ];

    const featurePoints = [
        { icon: SparklesIcon, name: "AI Study Planner", description: "Generate personalized weekly study plans for any subject to stay on track." },
        { icon: PencilIcon, name: "Collaborative Whiteboard", description: "Visualize complex problems together in real-time with a shared digital canvas." },
        { icon: ClipboardListIcon, name: "Shared Scratchpad", description: "Take notes, draft ideas, and share resources in a persistent group workspace." },
        { icon: CheckCircleIcon, name: "Group Quizzes", description: "Test your knowledge with fun, AI-generated quizzes and compete for the top spot." },
        { icon: UsersIcon, name: "Smart Matching", description: "Post a request for help and get connected with students who can assist you." },
        { icon: ChatBubbleIcon, name: "Instant Messaging", description: "Communicate with your study buddies and groups through our integrated chat." },
    ];

    return (
        <div className="bg-background text-onBackground w-full">
            {/* Auth Screen */}
            <section className="h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
                <div aria-hidden="true" className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/3 w-[40rem] h-[40rem] bg-gradient-to-br from-primary to-transparent rounded-full opacity-20 blur-3xl" />
                    <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/3 w-[40rem] h-[40rem] bg-gradient-to-tl from-secondary to-transparent rounded-full opacity-20 blur-3xl" />
                </div>
                <MotionGraphicsBackground />

                <div className="relative z-10">
                    <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                        <div className="flex items-center justify-center gap-3">
                            <BookOpenIcon className="h-10 w-auto text-primary" />
                            <h1 className="text-4xl font-bold text-onBackground">StudyBuddy.com</h1>
                        </div>
                        <h2 className="mt-2 text-center text-lg font-medium text-onSurface">
                            {isLogin ? 'Sign in to your account' : 'Create a new account' }
                        </h2>
                    </div>
                    <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                        <div className="bg-surface/80 backdrop-blur-md py-8 px-4 shadow-2xl shadow-primary/10 sm:rounded-lg sm:px-10 border border-gray-700">
                            <form className="space-y-6" onSubmit={handleSubmit}>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-onSurface">Username</label>
                                        <div className="mt-1"><input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-onSurface">Email address</label>
                                    <div className="mt-1"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} /></div>
                                </div>
                                <div>
                                    <label htmlFor="password"  className="block text-sm font-medium text-onSurface">Password</label>
                                    <div className="mt-1"><input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                </div>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="confirm-password"  className="block text-sm font-medium text-onSurface">Confirm Password</label>
                                        <div className="mt-1"><input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                    </div>
                                )}
                                {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
                                <div>
                                    <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-700 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all duration-[260ms] transform active:scale-95 hover:shadow-lg hover:shadow-primary/30">
                                        {isSubmitting ? 'Processing...' : (isLogin ? 'Sign in' : 'Create Account')}
                                    </button>
                                </div>
                            </form>
                            {isLogin && (
                                <div className="mt-4 text-sm text-center">
                                    <a href="#" className="font-medium text-primary hover:text-indigo-400">
                                        Forgot your password?
                                    </a>
                                </div>
                            )}
                            <div className="mt-6">
                                <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-onSurface">Or</span></div></div>
                                <div className="mt-6"><button onClick={toggleForm} className="w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-surface text-sm font-medium text-onSurface hover:bg-gray-700 transition-colors duration-[195ms]">
                                    {isLogin ? 'Create an account' : 'Sign in instead'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce transition-opacity duration-300 ${isInputFocused ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-pointer'}`}
                    onClick={() => !isInputFocused && document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })}
                    aria-hidden={isInputFocused}
                >
                    <svg className="w-6 h-6 text-onSurface" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </div>
            </section>

            <section id="why-us" className="py-24 px-4 sm:px-6 lg:px-8">
                <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Why Choose StudyBuddy?</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">Connect, collaborate, and conquer your courses like never before.</p>
                    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
                        {whyUsPoints.map((point) => (
                            <div key={point.title} className="flex flex-col items-center">
                                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/20 text-primary mb-4">
                                    <point.icon className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold text-onBackground">{point.title}</h3>
                                <p className="mt-2 text-onSurface">{point.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            
            <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface/50">
                 <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Powerful Features to Boost Your Learning</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">All the tools you need for academic success, in one place.</p>
                    <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {featurePoints.map(feature => (
                            <div key={feature.name} className="bg-surface p-6 rounded-lg text-left transform hover:-translate-y-2 transition-transform duration-300 border border-gray-700">
                                <feature.icon className="h-8 w-8 text-secondary mb-3"/>
                                <h3 className="text-lg font-semibold text-onBackground">{feature.name}</h3>
                                <p className="mt-1 text-onSurface text-sm">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                 </div>
            </section>

            <section id="security" className="py-24 px-4 sm:px-6 lg:px-8">
                 <div className="container mx-auto text-center">
                    <ShieldCheckIcon className="h-16 w-16 text-green-400 mx-auto mb-4"/>
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Your Safety is Our Priority</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface max-w-3xl mx-auto">We are committed to providing a secure and positive environment for focused learning.</p>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                        <div className="bg-surface p-6 rounded-lg border border-gray-700">
                            <h3 className="text-xl font-semibold text-onBackground">Report & Block System</h3>
                            <p className="mt-2 text-onSurface">Easily report or block any user displaying inappropriate behavior. Our moderation team will review all reports promptly to take necessary action and ensure community guidelines are upheld.</p>
                        </div>
                        <div className="bg-surface p-6 rounded-lg border border-gray-700">
                            <h3 className="text-xl font-semibold text-onBackground">AI-Powered Moderation</h3>
                            <p className="mt-2 text-onSurface">Our system uses advanced AI to proactively flag and review potentially harmful or off-topic content in public spaces, helping to maintain a productive and respectful atmosphere.</p>
                        </div>
                    </div>
                 </div>
            </section>
            
            <section id="creators" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface/50">
                 <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Meet the Team</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">The passionate creators behind StudyBuddy.</p>
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
                        {['Ishan', 'Gautham', 'Jude', 'Wilton'].map(name => (
                            <div key={name} className="flex flex-col items-center">
                                <UserCircleIcon className="h-20 w-20 text-onSurface"/>
                                <h3 className="mt-4 text-xl font-semibold text-onBackground">{name}</h3>
                            </div>
                        ))}
                    </div>
                 </div>
            </section>

            <footer className="py-8 px-4 text-center text-onSurface text-sm border-t border-gray-700">
                <p>&copy; {new Date().getFullYear()} StudyBuddy.com. All rights reserved.</p>
                <p className="mt-2">For support, contact us at: <a href="mailto:studybuddypartners@gmail.com" className="font-semibold text-primary hover:underline">studybuddypartners@gmail.com</a></p>
            </footer>
        </div>
    );
};

const AddMarksModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (subjectId: number, marks: string) => Promise<void>;
}> = ({ isOpen, onClose, onAdd }) => {
    const [marks, setMarks] = useState('');
    const [subjectId, setSubjectId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!subjectId) {
            setError('Please select a subject.');
            return;
        }
        if (!marks.trim()) {
            setError('Please enter your marks.');
            return;
        }
        setIsSubmitting(true);
        await onAdd(subjectId, marks.trim());
        setIsSubmitting(false);
        setMarks('');
        setSubjectId(null);
        onClose();
    };

    const inputClasses = "w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-primary focus:border-primary";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-onBackground">Add Your Marks</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block font-semibold text-onSurface mb-2">Subject</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {ALL_SUBJECTS.map(subject => (
                            <div key={subject.id} onClick={() => setSubjectId(subject.id)}
                                className={`text-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${subjectId === subject.id ? 'border-primary bg-primary/20 scale-105' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`}>
                                <span>{subject.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block font-semibold text-onSurface">Marks</label>
                    <input type="text" value={marks} onChange={e => setMarks(e.target.value)} required className={inputClasses} placeholder="e.g., A+, 95%, 4.0 GPA" />
                </div>
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-md hover:from-amber-500 hover:to-amber-400 transition disabled:opacity-50">
                        {isSubmitting ? 'Adding...' : 'Add Mark'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


const ProfilePage: React.FC = () => {
    const { currentUser, currentUserProfile, updateProfile } = useAuth();
    const [formData, setFormData] = useState<StudentProfile | null>(currentUserProfile);
    const [isSaved, setIsSaved] = useState(false);
    
    // Profile picture state
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
    const [profileUploadProgress, setProfileUploadProgress] = useState<number | null>(null);
    const [profileUploadError, setProfileUploadError] = useState<string | null>(null);
    const profileFileInputRef = useRef<HTMLInputElement>(null);

    // Study material state
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [materialImageFile, setMaterialImageFile] = useState<File | null>(null);
    const [materialImagePreview, setMaterialImagePreview] = useState<string | null>(null);
    const [materialDescription, setMaterialDescription] = useState('');
    const [materialUploadProgress, setMaterialUploadProgress] = useState<number | null>(null);
    const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
    const [materialUploadError, setMaterialUploadError] = useState<string | null>(null);
    const materialFileInputRef = useRef<HTMLInputElement>(null);

    // Marks state
    const [marks, setMarks] = useState<UserMark[]>([]);
    const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);


    useEffect(() => {
        setFormData(currentUserProfile);
    }, [currentUserProfile]);
    
    useEffect(() => {
        if (!currentUser) return;
        
        // Fetch study materials
        const matQuery = query(collection(db, "studyMaterials"), where("userId", "==", currentUser.uid));
        const unsubMaterials = onSnapshot(matQuery, (snapshot) => {
            const fetchedMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyMaterial));
            fetchedMaterials.sort((a, b) => b.uploadedAt - a.uploadedAt);
            setMaterials(fetchedMaterials);
        });

        // Fetch marks
        const marksQuery = query(collection(db, "profiles", currentUser.uid, "marks"), orderBy("createdAt", "desc"));
        const unsubMarks = onSnapshot(marksQuery, (snapshot) => {
            const fetchedMarks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMark));
            setMarks(fetchedMarks);
        });

        return () => {
            unsubMaterials();
            unsubMarks();
        };
    }, [currentUser]);

    if (!formData || !currentUser) {
        return <div className="container mx-auto p-8 animate-fadeInUp"><p>Loading profile...</p></div>
    }

    const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfileImageFile(file);
            setProfileImagePreview(URL.createObjectURL(file));
        }
    };

    const handleProfileImageUpload = async () => {
        if (!profileImageFile) return;
        setProfileUploadProgress(0);
        setProfileUploadError(null);

        const storageRef = ref(storage, `profile-pictures/${currentUser.uid}`);
        const uploadTask = uploadBytesResumable(storageRef, profileImageFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setProfileUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                setProfileUploadError("Upload failed. Please try again.");
                setProfileUploadProgress(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { photoURL: downloadURL });
                setProfileUploadProgress(100);
                setTimeout(() => {
                    setProfileUploadProgress(null);
                    setProfileImageFile(null);
                    setProfileImagePreview(null);
                }, 2000);
            }
        );
    };

    const handleMaterialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setMaterialImageFile(file);
            setMaterialImagePreview(URL.createObjectURL(file));
        }
    };

    const handleMaterialUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialImageFile || !materialDescription.trim()) {
            alert("Please select an image and provide a description.");
            return;
        }
        setIsUploadingMaterial(true);
        setMaterialUploadProgress(0);
        setMaterialUploadError(null);

        const storageRef = ref(storage, `study-materials/${currentUser.uid}/${Date.now()}_${materialImageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, materialImageFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setMaterialUploadProgress(progress);
            },
            (error) => {
                console.error("Material upload failed:", error);
                // This error is typically due to Firebase Storage rules not allowing writes.
                // This must be configured in the Firebase console and cannot be fixed from the frontend code.
                setMaterialUploadError("Upload failed due to a permission issue. Please contact support.");
                setIsUploadingMaterial(false);
                setMaterialUploadProgress(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, "studyMaterials"), {
                    userId: currentUser.uid,
                    imageUrl: downloadURL,
                    description: materialDescription,
                    uploadedAt: Date.now()
                });
                setIsUploadingMaterial(false);
                setMaterialUploadProgress(null);
                setMaterialImageFile(null);
                setMaterialImagePreview(null);
                setMaterialDescription('');
            }
        );
    };
    
    const handleDeleteMaterial = async (materialId: string) => {
        if (window.confirm("Are you sure you want to delete this material?")) {
            await deleteDoc(doc(db, "studyMaterials", materialId));
        }
    };

    const handleAddMark = async (subjectId: number, marksValue: string) => {
        const subject = ALL_SUBJECTS.find(s => s.id === subjectId);
        if (!subject || !currentUser) return;

        const marksColRef = collection(db, "profiles", currentUser.uid, "marks");
        await addDoc(marksColRef, {
            userId: currentUser.uid,
            subjectId,
            subjectName: subject.name,
            marks: marksValue,
            createdAt: Date.now(),
        });
    };

    const handleDeleteMark = async (markId: string) => {
        if (!currentUser) return;
        if (window.confirm("Are you sure you want to delete this mark?")) {
            const markDocRef = doc(db, "profiles", currentUser.uid, "marks", markId);
            await deleteDoc(markDocRef);
        }
    };

    const handleMultiSelect = (field: 'preferredMethods' | 'availability', value: any) => {
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

    const choiceBoxClasses = (isSelected: boolean) => {
        const base = "flex items-center justify-center text-center p-3 rounded-lg cursor-pointer transition-all duration-[260ms] border-2";
        if (isSelected) {
            return `${base} bg-primary/20 border-primary text-indigo-300 scale-105`;
        }
        return `${base} bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 hover:border-gray-500`;
    };

    return (
        <div className="container mx-auto p-8">
            <AddMarksModal isOpen={isMarksModalOpen} onClose={() => setIsMarksModalOpen(false)} onAdd={handleAddMark} />
            <h1 className="text-4xl font-bold mb-6 text-onBackground">Edit Your Profile</h1>
             <div className="bg-transparent p-8 rounded-lg mb-8 flex flex-col items-center">
                <div className="relative w-40 h-40">
                    <Avatar user={{...currentUser, photoURL: profileImagePreview || currentUser.photoURL}} className="w-40 h-40 text-5xl" />
                </div>
                <button onClick={() => profileFileInputRef.current?.click()} className="mt-4 px-3 py-1 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-all">
                    Change Picture
                </button>
                <input type="file" accept="image/*" onChange={handleProfileFileChange} ref={profileFileInputRef} className="hidden" />
                {profileImageFile && (
                    <div className="w-40 mt-2">
                        {profileUploadProgress === null ? (
                                <button onClick={handleProfileImageUpload} className="w-full px-3 py-1 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition-all">
                                Save Picture
                            </button>
                        ) : (
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${profileUploadProgress}%` }}></div>
                            </div>
                        )}
                        {profileUploadError && <p className="text-danger text-xs mt-1">{profileUploadError}</p>}
                        {profileUploadProgress === 100 && <p className="text-green-400 text-xs mt-1">Upload complete!</p>}
                    </div>
                )}
             </div>
            
            <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-lg shadow-lg space-y-8 border border-gray-700">
                <div>
                    <h3 className="text-lg font-semibold text-onBackground">My Availability</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                        {ALL_AVAILABILITY_OPTIONS.map(opt => (
                            <div key={opt} onClick={() => handleMultiSelect('availability', opt)} className={choiceBoxClasses(formData.availability.includes(opt))}>
                                <span>{opt}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold text-onBackground">Preferred Study Methods</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                        {ALL_STUDY_METHODS.map(method => (
                            <div key={method} onClick={() => handleMultiSelect('preferredMethods', method)} className={choiceBoxClasses(formData.preferredMethods.includes(method))}>
                                <span>{method}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-onBackground">Learning Style</h3>
                    <div className="flex flex-col md:flex-row gap-4 mt-2">
                        {ALL_LEARNING_STYLES.map(({style, description}) => (
                            <label key={style} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all duration-[260ms] ${formData.learningStyle === style ? 'border-primary bg-primary/20 scale-105' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                                <input type="radio" name="learningStyle" value={style} checked={formData.learningStyle === style} onChange={e => setFormData({...formData, learningStyle: e.target.value as LearningStyle})} className="sr-only"/>
                                <span className="font-bold block text-onBackground">{style}</span>
                                <span className="text-sm text-onSurface">{description}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button type="submit" className="px-6 py-3 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-all duration-[260ms] transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-primary/30">Save Profile</button>
                    <button type="button" onClick={() => setIsMarksModalOpen(true)} className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-semibold rounded-lg hover:from-amber-500 hover:to-amber-400 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-amber-500/30">Add Marks</button>
                    {isSaved && <div className="flex items-center gap-2 text-green-400 animate-fadeInUp"><CheckCircleIcon /><span>Profile saved!</span></div>}
                </div>
            </form>
            
            <div className="mt-8 bg-surface p-8 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-onBackground">My Marks</h2>
                {marks.length > 0 ? (
                    <div className="space-y-3">
                        {marks.map(mark => (
                            <div key={mark.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-onBackground">{mark.subjectName}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-amber-400 font-bold">{mark.marks}</span>
                                    <button onClick={() => handleDeleteMark(mark.id)} className="p-1.5 text-danger/70 hover:text-danger hover:bg-danger/20 rounded-full transition-colors">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-onSurface">You haven't added any marks yet.</p>
                )}
            </div>

            <div className="mt-8 bg-surface p-8 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-onBackground">My Study Materials</h2>
                <form onSubmit={handleMaterialUpload} className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 border border-dashed border-gray-600 rounded-lg">
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-32 h-32 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-600">
                            {materialImagePreview ? <img src={materialImagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" /> : <span className="text-gray-400 text-sm">Image Preview</span>}
                        </div>
                        <button type="button" onClick={() => materialFileInputRef.current?.click()} className="mt-2 text-sm text-primary hover:underline">Select Image</button>
                        <input type="file" accept="image/*" onChange={handleMaterialFileChange} ref={materialFileInputRef} className="hidden" />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-4">
                        <textarea value={materialDescription} onChange={e => setMaterialDescription(e.target.value)} placeholder="Description..." required className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground" rows={3}></textarea>
                        <button type="submit" disabled={isUploadingMaterial} className="w-full px-4 py-2 bg-secondary text-white font-semibold rounded-lg hover:bg-teal-500 transition disabled:opacity-50">
                            {isUploadingMaterial ? `Uploading ${materialUploadProgress?.toFixed(0)}%...` : 'Upload Material'}
                        </button>
                         {materialUploadError && <p className="text-danger text-sm mt-2 text-center">{materialUploadError}</p>}
                    </div>
                </form>

                {materials.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {materials.map(material => (
                            <div key={material.id} className="bg-background rounded-lg shadow-md overflow-hidden relative group border border-gray-700">
                                <img src={material.imageUrl} alt={material.description} className="w-full h-48 object-cover" />
                                <div className="p-4">
                                    <p className="text-onSurface text-sm">{material.description}</p>
                                </div>
                                <button onClick={() => handleDeleteMaterial(material.id)} className="absolute top-2 right-2 p-1.5 bg-danger/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-onSurface">You haven't uploaded any study materials yet.</p>
                )}
            </div>
        </div>
    );
};

const GroupsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const fetchGroups = async () => {
            setLoadingGroups(true);
            const groupsQuery = query(collection(db, "studyGroups"));
            const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
                const groupsData = snapshot.docs.map(doc => sanitizeGroup(doc.data(), doc.id));
                setGroups(groupsData);
                setLoadingGroups(false);
            });
            return unsubscribe;
        };

        const groupUnsubscribe = fetchGroups();

        return () => {
            if (typeof groupUnsubscribe === 'function') {
                (groupUnsubscribe as () => void)();
            }
        };
    }, [currentUser]);
    
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
    
    const GroupCard: React.FC<{group: StudyGroup, style?: React.CSSProperties, className?: string}> = ({ group, style, className }) => (
        <div style={style} className={`bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 transition-all duration-[390ms] hover:shadow-2xl hover:-translate-y-1 hover:shadow-secondary/20 border border-transparent hover:border-secondary/50 ${className || ''}`}>
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
                     <Link to={`/group/${group.id}`} className="w-full font-bold py-3 px-4 rounded-lg bg-green-500 text-white cursor-pointer flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5"/> View Group
                     </Link>
                ) : (
                    <button onClick={() => handleJoinGroup(group)} className="w-full font-bold py-3 px-4 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 text-onSecondary hover:from-teal-500 hover:to-teal-400 transition-all duration-[390ms] flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-secondary/30">
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
            <Modal isOpen={isOpen} onClose={onClose}>
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
                        <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white rounded-md hover:from-indigo-600 hover:to-indigo-400 transition">Create</button>
                    </div>
                </form>
            </Modal>
        )
    };
    
    return (
        <div className="container mx-auto p-8">
             <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreateGroup} />
             <div className="flex justify-between items-center mb-6">
                 <h1 className="text-4xl font-bold">Discover Groups</h1>
                 <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-colors shadow-lg hover:shadow-primary/30">
                    <PlusCircleIcon className="w-5 h-5" />
                    Create Group
                 </button>
             </div>
            { loadingGroups ? <p>Loading groups...</p> :
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {groups.map((group, index) => <GroupCard key={group.id} group={group} style={{ animationDelay: `${index * 100}ms`, opacity: 0 }} className="animate-fadeInUp"/>)}
               {groups.length === 0 && <p className="text-center text-onSurface col-span-full">No groups found. Why not create one?</p>}
            </div> }
        </div>
    );
};

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
            // No need to fetch the user document. We have the required info in the 'post' object.
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
        if (window.confirm("Are you sure you want to delete this request? This will also remove any pending offers.")) {
            try {
                const batch = writeBatch(db);
                
                // Delete associated requests
                const requestsQuery = query(collection(db, "studyRequests"), where("postId", "==", postId));
                const requestsSnapshot = await getDocs(requestsQuery);
                requestsSnapshot.forEach(doc => batch.delete(doc.ref));

                // Delete the post itself
                const postDocRef = doc(db, "studyPosts", postId);
                batch.delete(postDocRef);

                await batch.commit();
            } catch (error) {
                console.error("Error deleting post:", error);
                alert("Failed to delete post.");
            }
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
        <div className="container mx-auto p-8">
            <CreatePostModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreatePost} />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold">Study Requests</h1>
                <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-colors shadow-lg hover:shadow-primary/30">
                   <PlusCircleIcon className="w-5 h-5" />
                   New Request
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

const HomePage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
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
                                    <Link to="/messages" state={{ selectedBuddyId: buddy.uid }} className="text-sm text-primary hover:underline font-semibold">Message</Link>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="mt-4 text-onSurface">No active buddies yet. <Link to="/requests" className="text-primary hover:underline">Find a partner</Link> to get started!</p> )}
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
                                <Link to={`/group/${group.id}`} key={group.id} className="block p-4 bg-background rounded-lg transition hover:bg-gray-800 hover:shadow-md border border-gray-700 hover:border-primary/50">
                                    <h3 className="font-bold text-primary">{group.name}</h3>
                                    <p className="text-sm text-onSurface">{group.subjectName}</p>
                                    <p className="text-xs text-gray-400 mt-2">{group.memberIds.length} members</p>
                                </Link>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-onSurface">You haven't joined any groups yet. <Link to="/groups" className="text-primary hover:underline">Find a group</Link> to collaborate!</p>
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

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        const textToSend = newMessage.trim();
        if (!textToSend || !currentUser || !selectedBuddy) return;

        setNewMessage('');

        try {
            await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, { text: textToSend });
        } catch (error) {
            console.error("Failed to send message:", error);
            setNewMessage(textToSend);
        }
    };

    const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            handleImageUpload(file);
        }
    };

    const handleImageUpload = (file: File) => {
        if (!currentUser || !selectedBuddy) return;

        setIsUploadingImage(true);
        const storageRef = ref(storage, `chat-images/${[currentUser.uid, selectedBuddy.uid].sort().join('-')}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            () => {},
            (error) => {
                console.error("Image upload failed:", error);
                alert("Image upload failed. Please try again.");
                setIsUploadingImage(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await sendMessageToBuddy(currentUser.uid, selectedBuddy.uid, { imageUrl: downloadURL });
                setIsUploadingImage(false);
            }
        );
    };
    
    const showChat = !isMobile || (isMobile && selectedBuddy);
    const showContacts = !isMobile || (isMobile && !selectedBuddy);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Messages</h1>
            <div className="flex flex-col md:flex-row bg-surface shadow-lg rounded-lg h-[calc(100vh-12rem)] border border-gray-700">
                {/* Buddies List */}
                {showContacts && (
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col h-full">
                        <div className="p-4 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-onBackground">Contacts</h2>
                        </div>
                        <ul className="overflow-y-auto">
                            {buddies.map(buddy => (
                                <li key={buddy.uid} onClick={() => setSelectedBuddy(buddy)} className={`p-4 flex items-center gap-3 cursor-pointer transition-colors duration-[260ms] hover:bg-gray-800 ${selectedBuddy?.uid === buddy.uid ? 'bg-primary/20' : ''}`}>
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
                    <div className="w-full md:w-2/3 flex flex-col flex-1 h-full">
                        {selectedBuddy ? (
                            <>
                                <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                                     {isMobile && (
                                        <button onClick={() => setSelectedBuddy(null)} className="mr-2 text-onSurface">&larr;</button>
                                     )}
                                     <Avatar user={selectedBuddy} className="w-10 h-10" />
                                    <h2 className="text-xl font-semibold text-onBackground">{selectedBuddy.username}</h2>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto bg-background">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex mb-4 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs lg:max-w-md rounded-lg shadow-sm ${msg.senderId === currentUser?.uid ? 'bg-primary text-white' : 'bg-gray-700 text-onBackground'}`}>
                                                {msg.text && <p className="px-4 py-2 whitespace-pre-wrap">{msg.text}</p>}
                                                {msg.imageUrl && <img src={msg.imageUrl} alt="Shared content" className="rounded-lg max-w-full h-auto" />}
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
                                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 flex gap-2 bg-surface items-center">
                                    <input type="file" ref={imageInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                                    <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-onSurface hover:text-primary transition-colors">
                                        <PaperClipIcon className="w-6 h-6" />
                                    </button>
                                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"/>
                                    <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform active:scale-95">Send</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-onSurface">
                                <p>Select a buddy to start chatting.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const QuizLeaderboard: React.FC<{ quizId: string }> = ({ quizId }) => {
    const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "quizAttempts"), where("quizId", "==", quizId), orderBy("score", "desc"));
        const unsubscribe = onSnapshot(q, snapshot => {
            const attemptsData = snapshot.docs.map(doc => doc.data() as QuizAttempt);
            setAttempts(attemptsData);
            setLoading(false);
        });
        return unsubscribe;
    }, [quizId]);

    if (loading) return <div className="p-4 text-center text-onSurface">Loading scores...</div>;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-onBackground flex items-center gap-2"><ClipboardListIcon className="w-8 h-8 text-secondary" /> Quiz Results</h2>
            {attempts.length > 0 ? (
                <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {attempts.map((attempt, index) => (
                         <li key={index} className="flex items-center justify-between p-2 bg-background rounded-md border border-gray-700">
                             <div className="flex items-center gap-3">
                                <span className="font-bold text-lg text-secondary w-8 text-center">{index + 1}</span>
                                <span className="font-semibold text-onBackground">{attempt.username}</span>
                             </div>
                            <div className="text-secondary font-bold">{attempt.score} / {attempt.totalQuestions}</div>
                         </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-onSurface">No one has attempted this quiz yet.</p>
            )}
        </div>
    );
};

const QuizComponent: React.FC<{ group: StudyGroup }> = ({ group }) => {
    const { currentUser, currentUserProfile, updateProfile } = useAuth();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [isQuizOver, setIsQuizOver] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);

    const generateQuiz = async () => {
        setIsGenerating(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate a 5-question multiple choice quiz about ${group.subjectName}. For each question, provide 4 options and indicate the correct answer. Format the output as a JSON object with a "questions" array. Each object in the array should have "question", "options" (an array of 4 strings), and "correctAnswer" (a string matching one of the options).`;
            
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            questions: {
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
                        },
                        required: ["questions"]
                    },
                }
            });

            try {
                const quizData = JSON.parse(geminiResponse.text.trim());
                
                if (!quizData.questions || quizData.questions.length === 0) {
                     throw new Error("AI returned no questions.");
                }
    
                const newQuiz: Quiz = {
                    id: `quiz-${Date.now()}`,
                    groupId: group.id,
                    subjectName: group.subjectName,
                    questions: quizData.questions,
                    createdBy: currentUser!.uid,
                    createdAt: Date.now(),
                };
                setQuiz(newQuiz);
                setCurrentQuestion(0);
                setScore(0);
                setIsQuizOver(false);
            } catch (parseError) {
                console.error("Failed to parse quiz data from AI response:", parseError, "Raw text:", geminiResponse.text);
                setError('Failed to generate a valid quiz. The AI might be having trouble. Please try again.');
            }

        } catch (e) {
            console.error(e);
            setError('Failed to generate quiz. The AI might be busy. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnswer = async (answer: string) => {
        if (!quiz || selectedAnswer || !currentUser) return;
        
        const correctAnswer = quiz.questions[currentQuestion].correctAnswer;
        const newScore = answer === correctAnswer ? score + 1 : score;
        setSelectedAnswer(answer);
        
        if (answer === correctAnswer) {
            setIsCorrect(true);
        } else {
            setIsCorrect(false);
        }

        setTimeout(async () => {
            setSelectedAnswer(null);
            setIsCorrect(null);
            setScore(newScore);

            if (currentQuestion < quiz.questions.length - 1) {
                setCurrentQuestion(q => q + 1);
            } else {
                setIsQuizOver(true);
                // Save attempt
                await addDoc(collection(db, "quizAttempts"), {
                    quizId: quiz.id,
                    userId: currentUser.uid,
                    username: currentUser.username,
                    score: newScore,
                    totalQuestions: quiz.questions.length,
                    completedAt: Date.now(),
                });
                
                // Award a win for >50% score
                if (newScore / quiz.questions.length > 0.5) {
                    await updateProfile({ quizWins: (currentUserProfile?.quizWins || 0) + 1 });
                }
            }
        }, 1500);
    };

    const resetQuiz = () => {
        setQuiz(null);
        setIsQuizOver(false);
    };
    
    const getButtonClass = (option: string) => {
        if (!selectedAnswer) return "bg-gray-700 hover:bg-primary/50";
        const isCorrectAnswer = option === quiz!.questions[currentQuestion].correctAnswer;
        if (isCorrectAnswer) return "bg-green-500 text-white";
        if (option === selectedAnswer && !isCorrect) return "bg-danger text-white";
        return "bg-gray-700 opacity-50";
    };

    if (isQuizOver && quiz) {
        return (
            <div className="text-center p-4">
                <h3 className="text-2xl font-bold">Quiz Complete!</h3>
                <p className="text-xl mt-2">Your score: {score} / {quiz.questions.length}</p>
                 <div className="flex justify-center gap-4 mt-4">
                    <button onClick={resetQuiz} className="px-4 py-2 bg-primary text-white rounded-lg">Try Another Quiz</button>
                    <button onClick={() => setIsLeaderboardModalOpen(true)} className="px-4 py-2 bg-secondary text-white rounded-lg">View Leaderboard</button>
                </div>
                <Modal isOpen={isLeaderboardModalOpen} onClose={() => setIsLeaderboardModalOpen(false)}><QuizLeaderboard quizId={quiz.id} /></Modal>
            </div>
        );
    }

    if (quiz) {
        const question = quiz.questions[currentQuestion];
        return (
            <div className="p-4">
                <p className="text-sm text-onSurface">Question {currentQuestion + 1} of {quiz.questions.length}</p>
                <h4 className="text-lg font-semibold my-2">{question.question}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {question.options.map((opt, i) => (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selectedAnswer} className={`p-3 text-left rounded-lg transition-all duration-300 ${getButtonClass(opt)}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="text-center p-4">
            <p className="mb-4 text-onSurface">Challenge your group members with a quick quiz on {group.subjectName}!</p>
            <div className="flex justify-center gap-4">
                <button onClick={generateQuiz} disabled={isGenerating} className="px-6 py-3 bg-gradient-to-r from-secondary to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition transform active:scale-95 disabled:opacity-50">
                    {isGenerating ? 'Generating...' : 'Start New Quiz'}
                </button>
            </div>
            {error && <p className="text-danger mt-2">{error}</p>}
        </div>
    );
};

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

    if (!id) {
        return <div className="container mx-auto p-8 animate-fadeInUp text-center"><h1 className="text-2xl">Group Not Found</h1><p>The link may be broken or the group may have been deleted.</p></div>;
    }

    const contentDocRef = useMemo(() => doc(db, "studyGroups", id, "content", "shared"), [id]);
    
    useEffect(() => {
        setLoading(true);
        let groupLoaded = false;
        let contentLoaded = false;

        const checkDone = () => {
            if (groupLoaded && contentLoaded) {
                setLoading(false);
            }
        };

        const groupDocRef = doc(db, "studyGroups", id);
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

    const handleSendMessage = async (e: React.FormEvent, content: { text?: string; imageUrl?: string }) => {
        e.preventDefault();
        if (!currentUser || !id) return;
        if ((!content.text || !content.text.trim()) && !content.imageUrl) return;

        setNewMessage('');

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
    
    const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            handleImageUpload(file);
        }
    };

    const handleImageUpload = (file: File) => {
        if (!currentUser || !id) return;

        setIsUploadingImage(true);
        const storageRef = ref(storage, `group-chat-images/${id}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            () => {},
            (error) => {
                console.error("Image upload failed:", error);
                alert("Image upload failed. This may be a permissions issue.");
                setIsUploadingImage(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const pseudoEvent = { preventDefault: () => {} } as React.FormEvent;
                await handleSendMessage(pseudoEvent, { imageUrl: downloadURL });
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
        const groupDocRef = doc(db, "studyGroups", id);
        await updateDoc(groupDocRef, { name: newName.trim() });
        setIsEditingName(false);
    };

    const handleInviteBuddy = async (buddyId: string) => {
        if (!id) return;
        const groupRef = doc(db, "studyGroups", id);
        await updateDoc(groupRef, {
            memberIds: arrayUnion(buddyId)
        });
        setIsInviteDropdownOpen(false);
    };

    const handleLeaveGroup = async () => {
        if (!currentUser || !group) return;
        if (window.confirm("Are you sure you want to leave this group?")) {
            const groupDocRef = doc(db, "studyGroups", id);
            await updateDoc(groupDocRef, {
                memberIds: arrayRemove(currentUser.uid)
            });
            navigate('/groups');
        }
    };
    
    const handleDeleteGroup = async () => {
        if (!group || !currentUser || group.creatorId !== currentUser.uid) return;
        if (window.confirm(`Are you sure you want to permanently delete the group "${group.name}"? This action cannot be undone.`)) {
            try {
                const batch = writeBatch(db);

                // Delete messages subcollection
                const messagesQuery = query(collection(db, "studyGroups", group.id, "messages"));
                const messagesSnapshot = await getDocs(messagesQuery);
                messagesSnapshot.forEach(doc => batch.delete(doc.ref));

                // Delete content subcollection document
                const contentDocRef = doc(db, "studyGroups", group.id, "content", "shared");
                batch.delete(contentDocRef);
                
                // Delete group document itself
                const groupDocRef = doc(db, "studyGroups", group.id);
                batch.delete(groupDocRef);

                await batch.commit();

                navigate('/groups');
            } catch (error) {
                console.error("Error deleting group:", error);
                alert("Failed to delete group.");
            }
        }
    }

    if (loading) return <LoadingSpinner />;
    if (!group) return <div className="container mx-auto p-8 animate-fadeInUp text-center"><h1 className="text-2xl">Group not found.</h1></div>
    if (!sharedContent) return <LoadingSpinner />;

    const isCreator = currentUser?.uid === group.creatorId;
    const buddiesToInvite = buddies.filter(buddy => !group.memberIds.includes(buddy.uid));

    return (
        <div className="container mx-auto p-8">
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
                     <div className="bg-surface p-4 rounded-lg shadow-md border border-gray-700 h-96 lg:h-[calc(100vh-22rem)] flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 text-onBackground flex-shrink-0">Group Chat</h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex items-start gap-2 ${msg.senderId === currentUser?.uid ? 'flex-row-reverse' : ''}`}>
                                     <Avatar user={{ uid: msg.senderId, username: msg.senderUsername || '?', email: '', photoURL: msg.senderPhotoURL || undefined }} className="w-8 h-8 mt-1 flex-shrink-0" />
                                    <div className={`max-w-xs rounded-lg ${msg.senderId === currentUser?.uid ? 'bg-primary text-onPrimary' : 'bg-gray-700 text-onBackground'}`}>
                                        {msg.senderId !== currentUser?.uid && <p className="font-semibold text-xs text-primary mb-1 px-3 pt-2">{msg.senderUsername || 'User'}</p>}
                                        {msg.text && <p className="whitespace-pre-wrap text-sm px-3 py-2">{msg.text}</p>}
                                        {msg.imageUrl && <img src={msg.imageUrl} alt="Shared in chat" className="rounded-lg max-w-full h-auto" />}
                                    </div>
                                </div>
                            ))}
                             {isUploadingImage && (
                                <div className="flex justify-end mb-4">
                                    <div className="max-w-xs p-2 rounded-lg bg-primary opacity-50">
                                        <p className="text-sm text-white">Uploading image...</p>
                                    </div>
                                </div>
                             )}
                            <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={(e) => handleSendMessage(e, { text: newMessage })} className="mt-4 flex gap-2 flex-shrink-0 items-center">
                            <input type="file" ref={imageInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                            <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-onSurface hover:text-primary transition-colors">
                                <PaperClipIcon className="w-6 h-6" />
                            </button>
                            <input 
                                type="text" 
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Say something..."
                                className="flex-1 p-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-700 text-onBackground"
                            />
                            <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform active:scale-95">Send</button>
                        </form>
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
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsMembersListVisible(!isMembersListVisible)} 
                                    className="flex-1 text-center py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                                >
                                    <UsersIcon className="w-5 h-5" />
                                    <span>{isMembersListVisible ? 'Hide Members' : 'View All'}</span>
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

const UserProfilePage: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!username) return;
            setLoading(true);
            setError('');
            try {
                const usersQuery = query(collection(db, "users"), where("username", "==", username));
                const userSnapshot = await getDocs(usersQuery);

                if (userSnapshot.empty) {
                    setError("User not found.");
                    setUser(null);
                    setProfile(null);
                    setMaterials([]);
                    setLoading(false);
                    return;
                }

                const fetchedUser = { uid: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() } as User;
                setUser(fetchedUser);

                // Fetch profile
                const profileDoc = await getDoc(doc(db, "profiles", fetchedUser.uid));
                if (profileDoc.exists()) {
                    setProfile(sanitizeProfile(profileDoc.data(), fetchedUser.uid));
                }

                // Fetch study materials
                const materialsQuery = query(collection(db, "studyMaterials"), where("userId", "==", fetchedUser.uid));
                const materialsSnapshot = await getDocs(materialsQuery);
                const fetchedMaterials = materialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyMaterial));
                fetchedMaterials.sort((a, b) => b.uploadedAt - a.uploadedAt);
                setMaterials(fetchedMaterials);

            } catch (err) {
                console.error("Error fetching user profile:", err);
                setError("An error occurred while fetching the profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [username]);

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="container mx-auto p-8 text-center text-danger">{error}</div>;
    if (!user || !profile) return <div className="container mx-auto p-8 text-center">User profile not found.</div>;

    const ProfileDetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <div className="bg-surface/50 p-4 rounded-lg border border-gray-700">
            <h3 className="font-semibold text-onBackground mb-2">{title}</h3>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
    
    return (
        <div className="container mx-auto p-8">
            <div className="flex flex-col items-center mb-8">
                <Avatar user={user} className="w-32 h-32 text-4xl mb-4" />
                <h1 className="text-4xl font-bold text-onBackground">{user.username}</h1>
            </div>

            <div className="bg-surface p-8 rounded-lg shadow-lg border border-gray-700 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProfileDetailCard title="Learning Style">
                    <span className="bg-primary/20 text-indigo-300 text-sm font-medium px-2.5 py-0.5 rounded-full">{profile.learningStyle}</span>
                </ProfileDetailCard>
                <ProfileDetailCard title="Availability">
                    {profile.availability.map(item => <span key={item} className="bg-secondary/20 text-teal-300 text-sm font-medium px-2.5 py-0.5 rounded-full">{item}</span>)}
                </ProfileDetailCard>
                <ProfileDetailCard title="Preferred Methods">
                     {profile.preferredMethods.map(item => <span key={item} className="bg-amber-500/20 text-amber-300 text-sm font-medium px-2.5 py-0.5 rounded-full">{item}</span>)}
                </ProfileDetailCard>
            </div>
            
             <div className="bg-surface p-8 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-onBackground">Study Materials</h2>
                {materials.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {materials.map(material => (
                            <div key={material.id} className="bg-background rounded-lg shadow-md overflow-hidden border border-gray-700">
                                <img src={material.imageUrl} alt={material.description} className="w-full h-48 object-cover" />
                                <div className="p-4">
                                    <p className="text-onSurface text-sm">{material.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-onSurface">{user.username} hasn't uploaded any study materials yet.</p>
                )}
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

const AnimatedShapes: React.FC = () => (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="bg-shape bg-primary/10" style={{ width: '25vw', height: '25vw', top: '5%', left: '15%', animationDelay: '0s', animationDuration: '25s' }}></div>
        <div className="bg-shape bg-secondary/10" style={{ width: '15vw', height: '15vw', top: '60%', left: '70%', animationDelay: '3s', animationDuration: '20s' }}></div>
        <div className="bg-shape bg-amber-500/5" style={{ width: '30vw', height: '30vw', top: '40%', left: '5%', animationDelay: '6s', animationDuration: '30s' }}></div>
    </div>
);

const SplashScreen: React.FC<{ isFadingOut: boolean }> = ({ isFadingOut }) => {
    const appName = "StudyBuddy";
    return (
        <div className={`splash-screen ${isFadingOut ? 'fade-out' : ''}`}>
             <div className="animated-gradient" />
            <MotionGraphicsBackground />
            <div className="splash-content">
                <BookOpenIcon className="splash-logo" />
                <h1 className="splash-text">
                    {appName.split('').map((char, index) => (
                        <span key={index} style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
                            {char === ' ' ? '\u00A0' : char}
                        </span>
                    ))}
                </h1>
            </div>
        </div>
    );
};

const MainApp: React.FC = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    
    const [displayedLocation, setDisplayedLocation] = useState(location);
    const [transitionClass, setTransitionClass] = useState('animate-fadeInUp');
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const fadeOutTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 2500);

        const endTimer = setTimeout(() => {
            setIsAppLoading(false);
        }, 3000);

        return () => {
            clearTimeout(fadeOutTimer);
            clearTimeout(endTimer);
        };
    }, []);


    useEffect(() => {
        if (location.pathname !== displayedLocation.pathname) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/profile'];
            const oldIndex = routeOrder.indexOf(displayedLocation.pathname);
            const newIndex = routeOrder.indexOf(location.pathname);
            
            let outClass = 'animate-fadeOut';
            if (oldIndex > -1 && newIndex > -1) {
                outClass = newIndex > oldIndex ? 'animate-slideOutToLeft' : 'animate-slideOutToRight';
            }
            setTransitionClass(outClass);
        }
    }, [location, displayedLocation]);

    const handleAnimationEnd = () => {
        if (transitionClass.includes('Out') || transitionClass.includes('fadeOut')) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/profile'];
            const oldIndex = routeOrder.indexOf(displayedLocation.pathname);
            const newIndex = routeOrder.indexOf(location.pathname);

            let inClass = 'animate-fadeInUp';
            if (oldIndex > -1 && newIndex > -1) {
                inClass = newIndex > oldIndex ? 'animate-slideInFromRight' : 'animate-slideInFromLeft';
            }
            
            setDisplayedLocation(location);
            setTransitionClass(inClass);
        }
    };

    if (isAppLoading) {
        return <SplashScreen isFadingOut={isFadingOut} />;
    }

    return (
        <div className="min-h-screen bg-background relative">
            {currentUser && (
                <>
                    <div className="animated-gradient"></div>
                    <AnimatedShapes />
                </>
            )}
            <div className="relative z-10">
                {currentUser && <Header />}
                <main>
                    <div 
                        key={displayedLocation.pathname} 
                        className={transitionClass}
                        onAnimationEnd={handleAnimationEnd}
                    >
                        <Routes location={displayedLocation}>
                            <Route path="/auth" element={<AuthPage />} />
                            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                            <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                            <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                            <Route path="/group/:id" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
                            <Route path="/user/:username" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                            <Route path="*" element={<Navigate to={currentUser ? "/" : "/auth"} />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;