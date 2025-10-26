import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import AddMarksModal from './AddMarksModal';
import DeleteAccountModal from './DeleteAccountModal';
import Avatar from '../core/Avatar';
import { db, storage } from '../../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { StudyMaterial, UserMark, StudentProfile } from '../../types';
import { ALL_SUBJECTS } from '../../constants';
import { TrashIcon, PencilIcon, ExclamationTriangleIcon, PresentationChartBarIcon, DocumentDuplicateIcon, UserCircleIcon } from '../icons';
import { formatDuration } from '../../lib/helpers';
import MarksGraph from './MarksGraph';


const ProfilePage: React.FC = () => {
    const { currentUser, currentUserProfile } = useAuth();
    
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
    const [activeTab, setActiveTab] = useState<'progress' | 'materials' | 'settings'>('progress');

    
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

    if (!currentUser || !currentUserProfile) {
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

    const handleMaterialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setMaterialImageFile(file);
            setMaterialImagePreview(URL.createObjectURL(file));
            setMaterialUploadError(null);
        }
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
                if(materialFileInputRef.current) materialFileInputRef.current.value = "";
            }
        );
    };
    
    const handleDeleteMaterial = async (materialId: string) => { await deleteDoc(doc(db, "studyMaterials", materialId)); };

    const handleAddMark = async (subjectId: number, examName: string, marksObtained: number, totalMarks: number) => {
        const subject = ALL_SUBJECTS.find(s => s.id === subjectId);
        if (!subject || !currentUser) return;
        await addDoc(collection(db, "profiles", currentUser.uid, "marks"), {
            userId: currentUser.uid,
            subjectId,
            subjectName: subject.name,
            examName,
            marksObtained,
            totalMarks,
            createdAt: Date.now()
        });
    };

    const handleDeleteMark = async (markId: string) => { if (!currentUser) return; await deleteDoc(doc(db, "profiles", currentUser.uid, "marks", markId)); };

    const TabButton: React.FC<{ name: typeof activeTab, label: string, icon: React.FC<{className?: string}> }> = ({ name, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(name)}
            className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors duration-300 ${activeTab === name ? 'border-primary text-primary' : 'border-transparent text-onSurface hover:text-onBackground'}`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="container mx-auto p-4 sm:p-8">
            <AddMarksModal isOpen={isMarksModalOpen} onClose={() => setIsMarksModalOpen(false)} onAdd={handleAddMark} />
            <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />
            
            <div className="bg-surface p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-6 mb-8">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0 flex-shrink-0">
                    <Avatar user={{...currentUser, photoURL: profileImagePreview || currentUser.photoURL}} className="w-24 h-24 sm:w-32 sm:h-32 text-4xl" />
                    <button onClick={() => profileFileInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-2 bg-primary rounded-full text-white hover:bg-indigo-500 transition-transform hover:scale-110 shadow-md">
                        <PencilIcon className="w-5 h-5" />
                    </button>
                    <input type="file" accept="image/*" onChange={handleProfileFileChange} ref={profileFileInputRef} className="hidden" />
                     {profileUploadProgress !== null && (
                        <div className="absolute inset-0 rounded-full border-2 border-primary flex items-center justify-center bg-black/50">
                           <p className="text-white font-bold text-sm">{Math.round(profileUploadProgress)}%</p>
                        </div>
                    )}
                </div>
                <div className="flex-grow text-center sm:text-left">
                    <h1 className="text-2xl sm:text-3xl font-bold text-onBackground">{currentUser.username}</h1>
                    <p className="text-sm text-onSurface">{currentUser.email}</p>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-center border-t border-gray-700 pt-4">
                        <div>
                            <p className="text-2xl font-bold text-amber-400">{formatDuration(currentUserProfile.totalStudyTime || 0)}</p>
                            <p className="text-xs text-onSurface uppercase tracking-wider">Studied</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-secondary">{currentUserProfile.quizWins || 0}</p>
                            <p className="text-xs text-onSurface uppercase tracking-wider">Quiz Wins</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-primary">{currentUser.connections?.length || 0}</p>
                            <p className="text-xs text-onSurface uppercase tracking-wider">Buddies</p>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="border-b border-gray-700">
                    <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto">
                        <TabButton name="progress" label="Progress" icon={PresentationChartBarIcon} />
                        <TabButton name="materials" label="Materials" icon={DocumentDuplicateIcon} />
                        <TabButton name="settings" label="Settings" icon={UserCircleIcon} />
                    </nav>
                </div>
                <div className="mt-8">
                    {activeTab === 'progress' && (
                        <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700 animate-fadeInUp">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-onBackground">My Academic Progress</h2>
                                <button onClick={() => setIsMarksModalOpen(true)} className="px-4 py-1.5 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-teal-500 transition">Add Mark</button>
                            </div>
                            {marks.length > 0 ? (
                                <MarksGraph marks={marks} onDeleteMark={handleDeleteMark} />
                            ) : <p className="text-center text-onSurface py-4">No marks added yet. Add a mark to see your progress graph!</p>}
                        </div>
                    )}

                    {activeTab === 'materials' && (
                         <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700 animate-fadeInUp">
                             <h2 className="text-xl font-bold mb-4 text-onBackground">My Study Materials</h2>
                             <form onSubmit={handleMaterialUpload} className="mb-8 p-4 bg-background rounded-lg space-y-4">
                                 <h3 className="font-semibold">Upload New Material</h3>
                                 <div className="flex flex-col sm:flex-row gap-4">
                                     <div className="flex-shrink-0 w-32 h-32 bg-gray-700 rounded-md flex items-center justify-center border-2 border-dashed border-gray-500 cursor-pointer" onClick={() => materialFileInputRef.current?.click()}>
                                        {materialImagePreview ? <img src={materialImagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" /> : <span className="text-xs text-center text-gray-400">Select Image</span>}
                                     </div>
                                     <input type="file" accept="image/*" onChange={handleMaterialFileChange} ref={materialFileInputRef} className="hidden" />
                                     <div className="flex-grow space-y-2">
                                         <input type="text" value={materialDescription} onChange={e => setMaterialDescription(e.target.value)} placeholder="Description..." className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground" />
                                         <button type="submit" disabled={isUploadingMaterial} className="w-full sm:w-auto px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition disabled:opacity-50">
                                            {isUploadingMaterial ? `Uploading ${Math.round(materialUploadProgress || 0)}%...` : 'Upload'}
                                         </button>
                                          {materialUploadError && <p className="text-danger text-xs mt-1">{materialUploadError}</p>}
                                     </div>
                                 </div>
                             </form>

                             {materials.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {materials.map(mat => (
                                        <div key={mat.id} className="bg-background rounded-lg overflow-hidden group relative">
                                            <img src={mat.imageUrl} alt={mat.description} className="w-full h-40 object-cover" />
                                            <div className="p-3">
                                                <p className="text-sm text-onSurface truncate">{mat.description}</p>
                                            </div>
                                            <button onClick={() => handleDeleteMaterial(mat.id)} className="absolute top-2 right-2 p-1 bg-danger rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-onSurface py-4">No study materials uploaded yet.</p>}
                         </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700 animate-fadeInUp">
                            <h2 className="text-xl font-bold mb-4 text-onBackground">Account Settings</h2>
                            <div className="bg-danger/10 border border-danger/50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-danger flex items-center gap-2"><ExclamationTriangleIcon/>Delete Account</h3>
                                    <p className="text-sm text-rose-200 mt-1">Permanently delete your account and all associated data. This action is irreversible.</p>
                                </div>
                                <button onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 bg-danger text-white font-bold rounded-lg hover:bg-rose-700 transition flex-shrink-0">Delete My Account</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;