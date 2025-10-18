import React, { useState, useContext, createContext, useMemo, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { User, StudentProfile, LearningStyle } from '../../types';
import { sanitizeProfile } from '../../lib/helpers';


// --- AUTH CONTEXT ---
interface AuthContextType {
    currentUser: User | null;
    currentUserProfile: StudentProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
    signup: (email: string, username: string, pass: string) => Promise<void>;
    updateProfile: (profile: Partial<StudentProfile>) => Promise<void>;
    isStudyModalOpen: boolean;
    openStudyModal: () => void;
    closeStudyModal: () => void;
    incrementStudyTime: (seconds: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);

    const openStudyModal = useCallback(() => setIsStudyModalOpen(true), []);
    const closeStudyModal = useCallback(() => setIsStudyModalOpen(false), []);


    useEffect(() => {
        let userUnsubscribe: () => void = () => {};
        let profileUnsubscribe: () => void = () => {};

        const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            userUnsubscribe();
            profileUnsubscribe();

            if (firebaseUser) {
                setLoading(true);

                let userLoaded = false;
                let profileLoaded = false;

                const checkDone = () => {
                    if (userLoaded && profileLoaded) {
                        setLoading(false);
                    }
                };

                const userDocRef = doc(db, "users", firebaseUser.uid);
                userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCurrentUser({ uid: docSnap.id, ...docSnap.data() } as User);
                    } else {
                        setCurrentUser(null);
                    }
                    userLoaded = true;
                    checkDone();
                });

                const profileDocRef = doc(db, "profiles", firebaseUser.uid);
                profileUnsubscribe = onSnapshot(profileDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCurrentUserProfile(sanitizeProfile(docSnap.data(), firebaseUser.uid));
                    } else {
                        setCurrentUserProfile(null);
                    }
                    profileLoaded = true;
                    checkDone();
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

    const login = useCallback(async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    }, []);

    const logout = useCallback(() => {
        signOut(auth);
    }, []);

    const signup = useCallback(async (email: string, username: string, pass: string) => {
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
            totalStudyTime: 0,
        };
        await setDoc(doc(db, "profiles", firebaseUser.uid), newProfile);
    }, []);
    
     const checkForBadges = useCallback((profile: StudentProfile): string[] => {
        const newBadges: string[] = [];
        const isComplete = profile.bio && 
                           profile.learningStyle &&
                           profile.preferredMethods.length > 0 &&
                           profile.availability.length > 0;
        if (isComplete) {
            newBadges.push("Profile Pro");
        }
        return newBadges;
    }, []);

    const updateProfile = useCallback(async (updatedProfile: Partial<StudentProfile>) => {
        if (!currentUser || !currentUserProfile) throw new Error("Not authenticated");
        
        const newProfileData = { ...currentUserProfile, ...updatedProfile };
        
        const existingBadges = newProfileData.badges || [];
        const earnedBadges = checkForBadges(newProfileData);
        const allBadges = [...new Set([...existingBadges, ...earnedBadges])];
        
        const finalProfile = { ...newProfileData, badges: allBadges };
        
        const profileDocRef = doc(db, "profiles", currentUser.uid);
        await setDoc(profileDocRef, finalProfile, { merge: true });
    }, [currentUser, currentUserProfile, checkForBadges]);

    const incrementStudyTime = useCallback(async (seconds: number) => {
        if (!currentUser) throw new Error("Not authenticated");
        if (seconds <= 0) return;

        const profileDocRef = doc(db, "profiles", currentUser.uid);
        await updateDoc(profileDocRef, {
            totalStudyTime: increment(seconds)
        });
    }, [currentUser]);


    const value = useMemo(() => ({ 
        currentUser, currentUserProfile, loading, login, logout, signup, updateProfile, 
        isStudyModalOpen, openStudyModal, closeStudyModal, incrementStudyTime
    }), 
        [currentUser, currentUserProfile, loading, login, logout, signup, updateProfile, isStudyModalOpen, openStudyModal, closeStudyModal, incrementStudyTime]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);