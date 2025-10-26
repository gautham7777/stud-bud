import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { collection, onSnapshot, doc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudyGroup, GroupJoinRequest } from '../../types';
import { sanitizeGroup } from '../../lib/helpers';
import { ALL_SUBJECTS } from '../../constants';
import { UsersIcon, PlusCircleIcon, CheckCircleIcon, SearchIcon, ShieldCheckIcon } from '../icons';
import Modal from '../core/Modal';

const GroupsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [sentRequests, setSentRequests] = useState<GroupJoinRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'my-groups' | 'discover' | 'hosted'>('my-groups');

    useEffect(() => {
        if (!currentUser) return;
        
        setLoadingGroups(true);
        const groupsQuery = query(collection(db, "studyGroups"));
        const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
            const groupsData = snapshot.docs.map(doc => sanitizeGroup(doc.data(), doc.id));
            setGroups(groupsData);
            setLoadingGroups(false);
        });
        
        const requestsQuery = query(collection(db, "groupJoinRequests"), where("fromUserId", "==", currentUser.uid));
        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            const requestData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as GroupJoinRequest));
            setSentRequests(requestData);
        });


        return () => {
            unsubscribeGroups();
            unsubscribeRequests();
        };
    }, [currentUser]);
    
    const handleRequestToJoin = async (group: StudyGroup) => {
        if (!currentUser || group.creatorId === currentUser.uid) return;
        const existingRequest = sentRequests.find(r => r.groupId === group.id && r.status === 'pending');
        if (existingRequest) return;
        
        await addDoc(collection(db, "groupJoinRequests"), {
            groupId: group.id,
            groupName: group.name,
            fromUserId: currentUser.uid,
            fromUsername: currentUser.username,
            fromUserPhotoURL: currentUser.photoURL || null,
            toUserId: group.creatorId,
            status: 'pending',
            createdAt: Date.now(),
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
    
    const GroupCard: React.FC<{group: StudyGroup; isHost: boolean; context: typeof activeTab; style?: React.CSSProperties, className?: string}> = ({ group, isHost, context, style, className }) => {
        const isMember = group.memberIds.includes(currentUser!.uid);
        const pendingRequest = sentRequests.find(r => r.groupId === group.id && r.status === 'pending');

        const getButton = () => {
            if (isMember) {
                return (
                     <Link to={`/group/${group.id}`} className="w-full font-bold py-3 px-4 rounded-lg bg-green-500 text-white cursor-pointer flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5"/> View Group
                     </Link>
                );
            }
            if (pendingRequest) {
                return (
                    <button disabled className="w-full font-bold py-3 px-4 rounded-lg bg-gray-600 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2">
                        Request Sent
                    </button>
                );
            }
            return (
                <button onClick={() => handleRequestToJoin(group)} className="w-full font-bold py-3 px-4 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 text-onSecondary hover:from-teal-500 hover:to-teal-400 transition-all duration-[390ms] flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-secondary/30">
                    <PlusCircleIcon className="w-5 h-5"/> Request to Join
                </button>
            );
        };

        return (
            <div style={style} className={`bg-surface rounded-xl shadow-lg p-6 flex flex-col gap-4 transition-all duration-[390ms] hover:shadow-2xl hover:-translate-y-1 hover:shadow-secondary/20 border border-transparent hover:border-secondary/50 relative ${className || ''}`}>
                {isHost && context === 'my-groups' && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span>Host</span>
                    </div>
                )}
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
                    {getButton()}
                </div>
            </div>
        );
    }
    
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

    const myGroups = useMemo(() => currentUser ? groups.filter(g => g.memberIds.includes(currentUser.uid)) : [], [groups, currentUser]);
    const hostedGroups = useMemo(() => currentUser ? groups.filter(g => g.creatorId === currentUser.uid) : [], [groups, currentUser]);
    const discoverableGroups = useMemo(() => currentUser ? groups.filter(g => !g.memberIds.includes(currentUser.uid)) : [], [groups, currentUser]);

    const filteredDiscoverGroups = useMemo(() => discoverableGroups.filter(group => 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.subjectName.toLowerCase().includes(searchQuery.toLowerCase())
    ), [discoverableGroups, searchQuery]);

    const tabButtonClasses = (tabName: typeof activeTab) => 
        `px-4 py-2 font-semibold border-b-2 transition-colors duration-300 ${activeTab === tabName ? 'border-primary text-primary' : 'border-transparent text-onSurface hover:text-onBackground'}`;
    
    const renderContent = () => {
        const renderGroupList = (groupList: StudyGroup[], context: typeof activeTab) => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {groupList.map((group, index) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        isHost={currentUser?.uid === group.creatorId}
                        context={context}
                        style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                        className="animate-fadeInUp"
                    />
                ))}
            </div>
        );

        switch(activeTab) {
            case 'my-groups':
                return myGroups.length > 0 ? renderGroupList(myGroups, 'my-groups') : <p className="text-center text-onSurface col-span-full">You haven't joined any groups yet.</p>;
            case 'discover':
                return (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="relative flex-grow w-full md:w-auto">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search groups..."
                                    className="bg-surface text-onBackground placeholder-gray-400 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary w-full"
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <SearchIcon className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>
                            <button onClick={() => setCreateModalOpen(true)} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-400 transition-colors shadow-lg hover:shadow-primary/30 w-full md:w-auto justify-center">
                                <PlusCircleIcon className="w-5 h-5" />
                                <span className="sm:inline">Create Group</span>
                            </button>
                        </div>
                        {filteredDiscoverGroups.length > 0 ? renderGroupList(filteredDiscoverGroups, 'discover') : <p className="text-center text-onSurface col-span-full">No groups found matching your search. Why not create one?</p>}
                    </>
                );
            case 'hosted':
                return hostedGroups.length > 0 ? renderGroupList(hostedGroups, 'hosted') : <p className="text-center text-onSurface col-span-full">You haven't created any groups.</p>;
            default:
                return null;
        }
    };
    
    return (
        <div className="container mx-auto p-4 sm:p-8">
             <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreateGroup} />
             <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl sm:text-4xl font-bold">Study Groups</h1>
             </div>

             <div className="border-b border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button onClick={() => setActiveTab('my-groups')} className={tabButtonClasses('my-groups')}>My Groups</button>
                    <button onClick={() => setActiveTab('discover')} className={tabButtonClasses('discover')}>Discover</button>
                    <button onClick={() => setActiveTab('hosted')} className={tabButtonClasses('hosted')}>Hosted Groups</button>
                </nav>
            </div>
            
            { loadingGroups ? <p>Loading groups...</p> : renderContent() }
        </div>
    );
};

export default GroupsPage;