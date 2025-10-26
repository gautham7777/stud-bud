import React, { useState, useContext, createContext, useMemo, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
// FIX: Imported 'getDoc' from 'firebase/firestore' to resolve the 'Cannot find name' error. 'getDoc' is necessary for fetching a single document, which is used in the deleteAccount function.
import { doc, onSnapshot, setDoc, updateDoc, increment, collection, query, where, getDocs, writeBatch, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, deleteObject, listAll } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
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
    sendPasswordReset: (email: string) => Promise<void>;
    updateProfile: (profile: Partial<StudentProfile>) => Promise<void>;
    deleteAccount: (password: string) => Promise<void>;
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
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        if (!userCredential.user.emailVerified) {
            await sendEmailVerification(userCredential.user);
            await signOut(auth);
            throw new Error("Please verify your email. A new verification link has been sent to your inbox.");
        }
    }, []);

    const logout = useCallback(() => {
        signOut(auth);
    }, []);
    
    const sendPasswordReset = useCallback(async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    }, []);

    const signup = useCallback(async (email: string, username: string, pass: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const firebaseUser = userCredential.user;

        await sendEmailVerification(firebaseUser);

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
        
        // Sign out the user to force them to log in with a verified email.
        await signOut(auth);
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

    const _deleteUserData = async (uid: string, connections: string[]) => {
        console.log("Starting data cleanup for user:", uid);
        const batch = writeBatch(db);

        // 1. Delete main user docs
        batch.delete(doc(db, "users", uid));
        batch.delete(doc(db, "profiles", uid));

        // 2. Delete all subcollections of profile (e.g., marks)
        const marksQuery = query(collection(db, "profiles", uid, "marks"));
        const marksSnapshot = await getDocs(marksQuery);
        marksSnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Delete content created by the user
        const collectionsToClean = ["studyPosts", "discoverPosts", "studyMaterials", "studyRequests", "groupJoinRequests"];
        for (const collName of collectionsToClean) {
            const q = query(collection(db, collName), where("creatorId", "==", uid));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => batch.delete(doc.ref));
        }

        // 4. Remove user from connections of other users
        if (connections && connections.length > 0) {
            connections.forEach(partnerId => {
                const partnerRef = doc(db, "users", partnerId);
                batch.update(partnerRef, { connections: arrayRemove(uid) });
            });
        }
        
        // 5. Commit Firestore changes
        await batch.commit();
        console.log("Firestore data deleted.");

        // 6. Delete storage files
        try {
            const profilePicRef = ref(storage, `profile-pictures/${uid}`);
            await deleteObject(profilePicRef);
            console.log("Profile picture deleted.");
        } catch (e) {
            if ((e as any).code !== 'storage/object-not-found') console.error("Error deleting profile pic:", e);
        }

        try {
            const materialsFolderRef = ref(storage, `study-materials/${uid}`);
            const res = await listAll(materialsFolderRef);
            await Promise.all(res.items.map(itemRef => deleteObject(itemRef)));
            console.log("Study materials deleted.");
        } catch (e) {
            console.error("Error deleting study materials:", e);
        }

        console.log("Data cleanup complete.");
    };

    const deleteAccount = useCallback(async (password: string) => {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error("No user is currently signed in.");

        const credential = EmailAuthProvider.credential(user.email, password);
        
        await reauthenticateWithCredential(user, credential);
        
        // Re-fetch connections just before deletion
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const connections = userDoc.data()?.connections || [];
        
        await _deleteUserData(user.uid, connections);
        await deleteUser(user);

    }, []);


    const value = useMemo(() => ({ 
        currentUser, currentUserProfile, loading, login, logout, signup, sendPasswordReset, updateProfile, deleteAccount,
        isStudyModalOpen, openStudyModal, closeStudyModal, incrementStudyTime
    }), 
        [currentUser, currentUserProfile, loading, login, logout, signup, sendPasswordReset, updateProfile, deleteAccount, isStudyModalOpen, openStudyModal, closeStudyModal, incrementStudyTime]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);