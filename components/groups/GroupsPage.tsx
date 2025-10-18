

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, addDoc, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudyGroup } from '../../types';
import { sanitizeGroup } from '../../lib/helpers';
import { ALL_SUBJECTS } from '../../constants';
import { UsersIcon, PlusCircleIcon, CheckCircleIcon } from '../icons';
import Modal from '../core/Modal';

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

export default GroupsPage;
