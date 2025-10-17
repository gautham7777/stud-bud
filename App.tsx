import React, { useState, useContext, createContext, useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { User, StudentProfile, StudyGroup, Message, SharedContent, StudyRequest, Subject, LearningStyle, StudyMethod } from './types';
import { ALL_SUBJECTS, ALL_AVAILABILITY_OPTIONS, ALL_LEARNING_STYLES, ALL_STUDY_METHODS } from './constants';
import { BookOpenIcon, UsersIcon, ChatBubbleIcon, UserCircleIcon, LogoutIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, SearchIcon } from './components/icons';
import Whiteboard from './components/Whiteboard';

import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';


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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const profileDocRef = doc(db, "profiles", firebaseUser.uid);
                
                const [userDocSnap, profileDocSnap] = await Promise.all([
                    getDoc(userDocRef),
                    getDoc(profileDocRef)
                ]);

                if (userDocSnap.exists()) {
                    setCurrentUser({ uid: firebaseUser.uid, ...userDocSnap.data() } as User);
                }
                if (profileDocSnap.exists()) {
                    setCurrentUserProfile(profileDocSnap.data() as StudentProfile);
                } else {
                     setCurrentUserProfile(null); // Explicitly null if profile doesn't exist
                }
            } else {
                setCurrentUser(null);
                setCurrentUserProfile(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
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

        const newUser: User = { uid: firebaseUser.uid, email, username };
        const newProfile: StudentProfile = {
            userId: newUser.uid,
            bio: '',
            learningStyle: LearningStyle.Visual,
            preferredMethods: [],
            availability: [],
            subjectsNeedHelp: [],
            subjectsCanHelp: [],
        };

        await setDoc(doc(db, "users", newUser.uid), {email, username});
        await setDoc(doc(db, "profiles", newUser.uid), newProfile);
    };
    
    const updateProfile = async (updatedProfile: Partial<StudentProfile>) => {
        if (!currentUser) throw new Error("Not authenticated");
        const profileDocRef = doc(db, "profiles", currentUser.uid);
        await setDoc(profileDocRef, updatedProfile, { merge: true });
        setCurrentUserProfile(prev => {
            if (!prev) return null;
            return { ...prev, ...updatedProfile };
        });
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

// --- CORE UI COMPONENTS ---
const Header: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const navItems = [
        { path: '/', label: 'Dashboard', icon: BookOpenIcon },
        { path: '/discover', label: 'Discover', icon: SearchIcon },
        { path: '/messages', label: 'Messages', icon: ChatBubbleIcon },
        { path: '/profile', label: 'Profile', icon: UserCircleIcon },
    ];

    if (!currentUser) return null;

    return (
        <header className="bg-surface shadow-md sticky top-0 z-10">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-2 text-primary font-bold text-xl">
                            <BookOpenIcon className="h-8 w-8" />
                            <span>StudyBuddy</span>
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${location.pathname === item.path ? 'bg-primary text-onPrimary' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center">
                         <span className="text-gray-600 mr-4">Welcome, {currentUser.username}!</span>
                        <button onClick={logout} className="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            <LogoutIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </nav>
        </header>
    );
};

const getSubjectName = (id: number) => ALL_SUBJECTS.find(s => s.id === id)?.name || 'Unknown';

const UserCard: React.FC<{ user: User; profile: StudentProfile; onConnect: (userId: string) => void }> = ({ user, profile, onConnect }) => (
    <div className="bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center gap-4">
            <img src={`https://i.pravatar.cc/80?u=${user.uid}`} alt={user.username} className="w-20 h-20 rounded-full" />
            <div>
                <h3 className="text-2xl font-bold text-primary">{user.username}</h3>
                <p className="text-gray-500 italic">"{profile.bio || 'No bio yet.'}"</p>
            </div>
        </div>
        <div>
            <h4 className="font-semibold text-gray-700">Can Help With:</h4>
            <div className="flex flex-wrap gap-2 mt-1">
                {profile.subjectsCanHelp.length > 0 ? profile.subjectsCanHelp.map(id => <span key={id} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{getSubjectName(id)}</span>) : <span className="text-gray-400 text-sm">Nothing listed</span>}
            </div>
        </div>
        <div>
            <h4 className="font-semibold text-gray-700">Needs Help With:</h4>
            <div className="flex flex-wrap gap-2 mt-1">
                 {profile.subjectsNeedHelp.length > 0 ? profile.subjectsNeedHelp.map(id => <span key={id} className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{getSubjectName(id)}</span>) : <span className="text-gray-400 text-sm">Nothing listed</span>}
            </div>
        </div>
        <div className="mt-auto pt-4">
            <button onClick={() => onConnect(user.uid)} className="w-full bg-primary text-onPrimary font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 flex items-center justify-center gap-2">
                <PlusCircleIcon />
                Send Request
            </button>
        </div>
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
    const { login, signup, updateProfile } = useAuth();
    const navigate = useNavigate();

    // New state for multi-step signup
    const [signupStep, setSignupStep] = useState(1);
    const [subjectsNeedHelp, setSubjectsNeedHelp] = useState<number[]>([]);
    const [subjectsCanHelp, setSubjectsCanHelp] = useState<number[]>([]);

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            if (isLogin) {
                await login(email, password);
                navigate('/');
            } else {
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    setIsSubmitting(false);
                    return;
                }
                await signup(email, username, password);
                setSignupStep(2); // Move to the next step
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred.');
        } finally {
            if (isLogin) setIsSubmitting(false); // only stop submitting for login, signup continues
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await updateProfile({ subjectsNeedHelp, subjectsCanHelp });
            navigate('/');
        } catch(err: any) {
            setError(err.message || "Failed to save profile.");
        } finally {
            setIsSubmitting(false);
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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            {signupStep === 1 ? (
                <>
                    <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                        <BookOpenIcon className="mx-auto h-12 w-auto text-primary" />
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            {isLogin ? 'Sign in to your account' : 'Create a new account'}
                        </h2>
                    </div>
                    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                            <form className="space-y-6" onSubmit={handleCredentialsSubmit}>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                                        <div className="mt-1"><input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/></div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                                    <div className="mt-1"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" /></div>
                                </div>
                                <div>
                                    <label htmlFor="password"  className="block text-sm font-medium text-gray-700">Password</label>
                                    <div className="mt-1"><input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/></div>
                                </div>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="confirm-password"  className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                        <div className="mt-1"><input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/></div>
                                    </div>
                                )}

                                {error && <p className="text-sm text-red-600">{error}</p>}

                                <div><button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">{isSubmitting ? 'Processing...' : (isLogin ? 'Sign in' : 'Continue')}</button></div>
                            </form>
                            <div className="mt-6">
                                <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div></div>
                                <div className="mt-6"><button onClick={toggleForm} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">{isLogin ? 'Create an account' : 'Sign in instead'}</button></div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
                    <h2 className="text-center text-3xl font-extrabold text-gray-900">One last step, {username}!</h2>
                    <p className="mt-2 text-center text-sm text-gray-600">This helps us find your perfect study buddy.</p>
                    <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <form className="space-y-8" onSubmit={handleProfileSubmit}>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Subjects I need help with:</h3>
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {ALL_SUBJECTS.map(subject => (
                                        <label key={`need-${subject.id}`} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition has-[:checked]:bg-yellow-100 has-[:checked]:ring-2 has-[:checked]:ring-yellow-400">
                                            <input type="checkbox" onChange={() => handleSubjectSelect('need', subject.id)} className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"/>
                                            <span>{subject.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Subjects I can help with:</h3>
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {ALL_SUBJECTS.map(subject => (
                                        <label key={`can-${subject.id}`} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-400">
                                            <input type="checkbox" onChange={() => handleSubjectSelect('can', subject.id)} className="form-checkbox h-5 w-5 text-secondary rounded focus:ring-secondary"/>
                                            <span>{subject.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <div>
                                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-secondary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50">
                                    {isSubmitting ? 'Saving...' : 'Finish & Find Buddies!'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProfilePage: React.FC = () => {
    const { currentUserProfile, updateProfile } = useAuth();
    const [formData, setFormData] = useState<StudentProfile | null>(currentUserProfile);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setFormData(currentUserProfile);
    }, [currentUserProfile]);

    if (!formData) {
        return <div className="container mx-auto p-8"><p>Loading profile...</p></div>
    }

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

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Edit Your Profile</h1>
            <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-lg shadow-lg space-y-8">
                <div>
                    <label className="text-lg font-semibold">About Me</label>
                    <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="mt-2 w-full p-2 border rounded-md" rows={3}></textarea>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold">Subjects I Need Help With</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {ALL_SUBJECTS.map(subject => (
                            <label key={subject.id} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                <input type="checkbox" checked={formData.subjectsNeedHelp.includes(subject.id)} onChange={() => handleMultiSelect('subjectsNeedHelp', subject.id)} className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"/>
                                <span>{subject.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold">Subjects I Can Help With</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {ALL_SUBJECTS.map(subject => (
                            <label key={subject.id} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                <input type="checkbox" checked={formData.subjectsCanHelp.includes(subject.id)} onChange={() => handleMultiSelect('subjectsCanHelp', subject.id)} className="form-checkbox h-5 w-5 text-secondary rounded focus:ring-secondary"/>
                                <span>{subject.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold">My Availability</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {ALL_AVAILABILITY_OPTIONS.map(opt => (
                            <label key={opt} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                <input type="checkbox" checked={formData.availability.includes(opt)} onChange={() => handleMultiSelect('availability', opt)} className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"/>
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold">Preferred Study Methods</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {ALL_STUDY_METHODS.map(method => (
                            <label key={method} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                <input type="checkbox" checked={formData.preferredMethods.includes(method)} onChange={() => handleMultiSelect('preferredMethods', method)} className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"/>
                                <span>{method}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold">Learning Style</h3>
                    <div className="flex flex-col md:flex-row gap-4 mt-2">
                        {ALL_LEARNING_STYLES.map(({style, description}) => (
                            <label key={style} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition ${formData.learningStyle === style ? 'border-primary bg-indigo-50' : 'border-gray-200'}`}>
                                <input type="radio" name="learningStyle" value={style} checked={formData.learningStyle === style} onChange={e => setFormData({...formData, learningStyle: e.target.value as LearningStyle})} className="sr-only"/>
                                <span className="font-bold block">{style}</span>
                                <span className="text-sm text-gray-500">{description}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button type="submit" className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition">Save Profile</button>
                    {isSaved && <div className="flex items-center gap-2 text-green-600"><CheckCircleIcon /><span>Profile saved!</span></div>}
                </div>
            </form>
        </div>
    );
};

const DiscoverPage: React.FC = () => {
    const { currentUser, currentUserProfile } = useAuth();
    const [allUsers, setAllUsers] = useState<{user: User, profile: StudentProfile}[]>([]);
    const [loading, setLoading] = useState(true);
    const [studyRequests, setStudyRequests] = useState<StudyRequest[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!currentUser) return;
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
                .filter(item => item.profile); // Ensure profile exists

            setAllUsers(combinedData);
            setLoading(false);
        };
        fetchUsers();
    }, [currentUser]);

    if (loading) {
        return <div className="container mx-auto p-8"><p>Finding potential buddies...</p></div>
    }

    if (!currentUserProfile || (currentUserProfile.subjectsCanHelp.length === 0 && currentUserProfile.subjectsNeedHelp.length === 0)) {
        return <div className="container mx-auto p-8 text-center">
            <p className="text-lg text-gray-700">Please complete your profile first to discover other students.</p>
            <Link to="/profile" className="mt-4 inline-block bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">Go to Profile</Link>
        </div>;
    }

    const calculateMatchScore = (otherProfile: StudentProfile) => {
        let score = 0;
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
    
    const handleConnect = (toUserId: string) => {
        if (!studyRequests.some(r => r.toUserId === toUserId && r.fromUserId === currentUser!.uid)) {
            setStudyRequests(prev => [...prev, { fromUserId: currentUser!.uid, toUserId, status: 'pending' }]);
            alert('Study request sent!'); // Placeholder for a real notification system
        }
    };
    
    return (
        <div className="container mx-auto p-8">
             <h1 className="text-3xl font-bold mb-6">Find a Study Buddy</h1>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {potentialMatches.map(({ user, profile }) => (
                    <UserCard key={user.uid} user={user} profile={profile} onConnect={handleConnect} />
                ))}
             </div>
             {potentialMatches.length === 0 && <p className="text-center text-gray-500 col-span-full">No matches found. Try broadening your profile criteria!</p>}
        </div>
    );
};

const HomePage: React.FC = () => {
    const { currentUser } = useAuth();
    return (
        <div className="container mx-auto p-8">
             <h1 className="text-4xl font-bold text-gray-800">Welcome back, {currentUser?.username}!</h1>
             <p className="mt-2 text-lg text-gray-600">Here's your study dashboard.</p>
             <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><UsersIcon/> My Study Groups</h2>
                    <p className="mt-4 text-gray-500">No active groups yet. <Link to="/discover" className="text-primary hover:underline">Find a partner</Link> to start one!</p>
                </div>
                 <div className="bg-surface p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><ChatBubbleIcon/> Pending Requests</h2>
                    <p className="mt-4 text-gray-500">You have no pending study requests.</p>
                </div>
                 <div className="bg-surface p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><SearchIcon/> Quick Links</h2>
                    <ul className="mt-4 space-y-2">
                        <li><Link to="/profile" className="text-primary hover:underline">Update Your Profile</Link></li>
                        <li><Link to="/discover" className="text-primary hover:underline">Discover New Partners</Link></li>
                        <li><Link to="/messages" className="text-primary hover:underline">Check Your Messages</Link></li>
                    </ul>
                </div>
             </div>
        </div>
    );
};

const MessagesPage: React.FC = () => (
    <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        <div className="bg-surface p-8 rounded-lg shadow-md text-center">
            <ChatBubbleIcon className="h-16 w-16 mx-auto text-gray-300" />
            <p className="mt-4 text-gray-500">Your message inbox is empty. Connect with a study buddy to start a conversation.</p>
        </div>
    </div>
);

const GroupPage: React.FC = () => {
    const { id } = useParams();
    const [scratchpad, setScratchpad] = useState("## Shared Notes\n\n- Let's start by outlining the main topics for today.");
    const [whiteboardData, setWhiteboardData] = useState([]);
    
    const groupName = "Physics Problem Solvers"; // Placeholder

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">Group Workspace: {groupName}</h1>
            <p className="text-gray-500 mb-6">Group ID: {id}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Shared Scratchpad</h2>
                    <textarea 
                        className="w-full h-96 p-4 border rounded-lg shadow-inner font-mono text-sm"
                        value={scratchpad}
                        onChange={(e) => setScratchpad(e.target.value)}
                    />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Shared Whiteboard</h2>
                    <Whiteboard width={500} height={400} onDraw={setWhiteboardData} initialData={whiteboardData}/>
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
            <main>
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