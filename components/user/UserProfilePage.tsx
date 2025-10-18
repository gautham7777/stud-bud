
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, StudentProfile, StudyMaterial } from '../../types';
import { sanitizeProfile } from '../../lib/helpers';
import LoadingSpinner from '../core/LoadingSpinner';
import Avatar from '../core/Avatar';

const UserProfilePage: React.FC = () => {
    const { username } = ReactRouterDOM.useParams<{ username: string }>();
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

export default UserProfilePage;