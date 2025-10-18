import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import AddMarksModal from './AddMarksModal';
import Avatar from '../core/Avatar';
import { db, storage } from '../../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { StudyMaterial, UserMark, StudentProfile, LearningStyle } from '../../types';
import { ALL_AVAILABILITY_OPTIONS, ALL_STUDY_METHODS, ALL_LEARNING_STYLES, ALL_SUBJECTS } from '../../constants';
import { CheckCircleIcon, TrashIcon } from '../icons';


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
                setMaterialUploadError("Upload failed. Check Firebase Storage rules to allow writes (e.g., `allow write: if request.auth != null;`)");
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
        await deleteDoc(doc(db, "studyMaterials", materialId));
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
        const markDocRef = doc(db, "profiles", currentUser.uid, "marks", markId);
        await deleteDoc(markDocRef);
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

export default ProfilePage;
