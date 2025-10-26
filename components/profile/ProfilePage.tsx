import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import AddMarksModal from './AddMarksModal';
import DeleteAccountModal from './DeleteAccountModal';
import Avatar from '../core/Avatar';
import { db, storage } from '../../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { StudyMaterial, UserMark, StudentProfile, LearningStyle } from '../../types';
import { ALL_AVAILABILITY_OPTIONS, ALL_STUDY_METHODS, ALL_LEARNING_STYLES, ALL_SUBJECTS } from '../../constants';
import { CheckCircleIcon, TrashIcon, UsersIcon, ClockIcon, ClipboardListIcon, PencilIcon, ExclamationTriangleIcon, LightbulbIcon } from '../icons';
import { formatDuration } from '../../lib/helpers';


const ProfilePage: React.FC = () => {
    const { currentUser, currentUserProfile, updateProfile } = useAuth();
    const [formData, setFormData] = useState<StudentProfile | null>(currentUserProfile);
    const [isSaved, setIsSaved] = useState(false);
    
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
    const [profileUploadProgress, setProfileUploadProgress] = useState<number | null>(null);
    const [profileUploadError, setProfileUploadError] = useState<string | null>(null);
    const profileFileInputRef = useRef<HTMLInputElement>(null);

    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [materialImageFile, setMaterialImageFile] = useState<File | null>(null);
    const [materialImagePreview, setMaterialImagePreview] = useState<string | null>(null);
    const [materialDescription, setMaterialDescription] = useState('');
    const [materialUploadProgress, setMaterialUploadProgress] = useState<number | null>(null);
    const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
    const [materialUploadError, setMaterialUploadError] = useState<string | null>(null);
    const materialFileInputRef = useRef<HTMLInputElement>(null);

    const [marks, setMarks] = useState<UserMark[]>([]);
    const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);


    useEffect(() => {
        setFormData(currentUserProfile);
    }, [currentUserProfile]);
    
    useEffect(() => {
        if (!currentUser) return;
        
        const matQuery = query(collection(db, "studyMaterials"), where("userId", "==", currentUser.uid), orderBy("uploadedAt", "desc"));
        const unsubMaterials = onSnapshot(matQuery, (snapshot) => {
            setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyMaterial)));
        });

        const marksQuery = query(collection(db, "profiles", currentUser.uid, "marks"), orderBy("createdAt", "desc"));
        const unsubMarks = onSnapshot(marksQuery, (snapshot) => {
            setMarks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMark)));
        });

        return () => { unsubMaterials(); unsubMarks(); };
    }, [currentUser]);

    if (!formData || !currentUser || !currentUserProfile) {
        return <div className="container mx-auto p-8 animate-fadeInUp"><p>Loading profile...</p></div>
    }

    const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfileImageFile(file);
            setProfileImagePreview(URL.createObjectURL(file));
            setProfileUploadError(null);
            handleProfileImageUpload(file); // Auto-upload on select
        }
    };

    const handleProfileImageUpload = async (file: File) => {
        setProfileUploadProgress(0);
        setProfileUploadError(null);

        const storageRef = ref(storage, `profile-pictures/${currentUser.uid}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => setProfileUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            (error) => {
                setProfileUploadError("Upload failed. Permission denied?");
                setProfileUploadProgress(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(doc(db, "users", currentUser.uid), { photoURL: downloadURL });
                setProfileUploadProgress(100);
                setTimeout(() => {
                    setProfileUploadProgress(null);
                    setProfileImageFile(null);
                    setProfileImagePreview(null);
                }, 2000);
            }
        );
    };

    const handleMaterialUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialImageFile || !materialDescription.trim()) {
            setMaterialUploadError("Please select an image and provide a description.");
            return;
        }
        setIsUploadingMaterial(true);
        setMaterialUploadProgress(0);
        setMaterialUploadError(null);

        const storageRef = ref(storage, `study-materials/${currentUser.uid}/${Date.now()}_${materialImageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, materialImageFile);

        uploadTask.on('state_changed',
            (snapshot) => setMaterialUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            (error) => {
                setMaterialUploadError("Upload failed. Permission may be denied.");
                setIsUploadingMaterial(false);
                setMaterialUploadProgress(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, "studyMaterials"), { userId: currentUser.uid, imageUrl: downloadURL, description: materialDescription, uploadedAt: Date.now() });
                setIsUploadingMaterial(false);
                setMaterialUploadProgress(null);
                setMaterialImageFile(null);
                setMaterialImagePreview(null);
                setMaterialDescription('');
            }
        );
    };
    
    const handleDeleteMaterial = async (materialId: string) => { await deleteDoc(doc(db, "studyMaterials", materialId)); };

    const handleAddMark = async (subjectId: number, marksValue: string) => {
        const subject = ALL_SUBJECTS.find(s => s.id === subjectId);
        if (!subject || !currentUser) return;
        await addDoc(collection(db, "profiles", currentUser.uid, "marks"), { userId: currentUser.uid, subjectId, subjectName: subject.name, marks: marksValue, createdAt: Date.now() });
    };

    const handleDeleteMark = async (markId: string) => { if (!currentUser) return; await deleteDoc(doc(db, "profiles", currentUser.uid, "marks", markId)); };

    const handleMultiSelect = (field: 'preferredMethods' | 'availability', value: any) => {
        const currentValues = formData[field] as any[];
        const newValues = currentValues.includes(value) ? currentValues.filter(v => v !== value) : [...currentValues, value];
        setFormData({ ...formData, [field]: newValues });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateProfile(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const choiceBoxClasses = (isSelected: boolean) => `flex items-center justify-center text-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected ? 'border-primary bg-primary/20 scale-105' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`;

    return (
        <div className="container mx-auto p-4 sm:p-8">
            <AddMarksModal isOpen={isMarksModalOpen} onClose={() => setIsMarksModalOpen(false)} onAdd={handleAddMark} />
            <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700 text-center">
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto">
                            <Avatar user={{...currentUser, photoURL: profileImagePreview || currentUser.photoURL}} className="w-24 h-24 sm:w-32 sm:h-32 text-4xl" />
                            <button onClick={() => profileFileInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-2 bg-primary rounded-full text-white hover:bg-indigo-500 transition-transform hover:scale-110 shadow-md">
                                <PencilIcon className="w-5 h-5" />
                            </button>
                            <input type="file" accept="image/*" onChange={handleProfileFileChange} ref={profileFileInputRef} className="hidden" />
                        </div>
                        {profileUploadProgress !== null && (
                            <div className="w-24 sm:w-32 mx-auto mt-3 bg-gray-700 rounded-full h-1.5">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${profileUploadProgress}%` }}></div>
                            </div>
                        )}
                        <h1 className="text-xl sm:text-2xl font-bold mt-4 text-onBackground">{currentUser.username}</h1>
                        <p className="text-sm text-onSurface">{currentUser.email}</p>
                        
                        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-xl sm:text-2xl font-bold text-amber-400">{formatDuration(currentUserProfile.totalStudyTime || 0)}</p>
                                <p className="text-xs text-onSurface uppercase">Studied</p>
                            </div>
                            <div>
                                <p className="text-xl sm:text-2xl font-bold text-secondary">{currentUserProfile.quizWins || 0}</p>
                                <p className="text-xs text-onSurface uppercase">Quiz Wins</p>
                            </div>
                            <div>
                                <p className="text-xl sm:text-2xl font-bold text-primary">{currentUser.connections?.length || 0}</p>
                                <p className="text-xs text-onSurface uppercase">Buddies</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700">
                        <h2 className="text-xl font-bold mb-4 text-onBackground flex items-center gap-2"><LightbulbIcon className="text-primary"/>My Preferences</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <h3 className="text-md font-semibold text-onSurface mb-2">My Availability</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {ALL_AVAILABILITY_OPTIONS.map(opt => <div key={opt} onClick={() => handleMultiSelect('availability', opt)} className={choiceBoxClasses(formData.availability.includes(opt))}>{opt}</div>)}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-md font-semibold text-onSurface mb-2">Preferred Study Methods</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {ALL_STUDY_METHODS.map(method => <div key={method} onClick={() => handleMultiSelect('preferredMethods', method)} className={choiceBoxClasses(formData.preferredMethods.includes(method))}>{method}</div>)}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button type="submit" className="px-6 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition transform hover:scale-105 active:scale-95">Save Preferences</button>
                                {isSaved && <div className="flex items-center gap-2 text-green-400 animate-fadeInUp"><CheckCircleIcon /><span>Saved!</span></div>}
                            </div>
                        </form>
                    </div>

                    <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-onBackground flex items-center gap-2"><ClipboardListIcon className="text-secondary"/>My Progress</h2>
                            <button onClick={() => setIsMarksModalOpen(true)} className="px-4 py-1.5 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-teal-500 transition">Add Mark</button>
                        </div>
                        {marks.length > 0 ? (
                            <div className="space-y-2">
                                {marks.map(mark => (
                                    <div key={mark.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                                        <span className="font-semibold text-onSurface">{mark.subjectName}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-amber-400 font-bold">{mark.marks}</span>
                                            <button onClick={() => handleDeleteMark(mark.id)} className="p-1 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-full transition"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-center text-onSurface py-4">No marks added yet.</p>}
                    </div>
                    
                    <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700">
                        <h2 className="text-xl font-bold mb-4 text-onBackground flex items-center gap-2"><UsersIcon className="text-amber-500"/>Account Settings</h2>
                        <div className="bg-danger/10 border border-danger/50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-danger flex items-center gap-2"><ExclamationTriangleIcon/>Delete Account</h3>
                                <p className="text-sm text-rose-200 mt-1">Permanently delete your account and all associated data. This action is irreversible.</p>
                            </div>
                            <button onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 bg-danger text-white font-bold rounded-lg hover:bg-rose-700 transition flex-shrink-0">Delete My Account</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProfilePage;