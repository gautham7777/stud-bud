import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { BookOpenIcon, UsersIcon, ChatBubbleIcon, UserCircleIcon, LogoutIcon, SearchIcon, ClipboardListIcon, XCircleIcon, CompassIcon, ClockIcon, SparklesIcon } from '../icons';
import Avatar from './Avatar';

const Header: React.FC = () => {
    const { currentUser, logout, openStudyModal } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const [isTimeDropdownOpen, setTimeDropdownOpen] = useState(false);
    const timeDropdownRef = useRef<HTMLDivElement>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/user/${searchQuery.trim()}`);
            setSearchQuery('');
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
                setTimeDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: BookOpenIcon },
        { path: '/groups', label: 'Groups', icon: UsersIcon },
        { path: '/requests', label: 'Requests', icon: ClipboardListIcon },
        { path: '/messages', label: 'Messages', icon: ChatBubbleIcon },
        { path: '/discover', label: 'Discover', icon: CompassIcon },
        { path: '/ai', label: 'AI Tools', icon: SparklesIcon },
    ];
    
    const profileItem = { path: '/profile', label: 'Profile', icon: UserCircleIcon };

    if (!currentUser) return null;
    
    const mainNavLinks = navItems.map(item => (
        <Link
            key={item.path}
            to={item.path}
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200 text-sm ${location.pathname === item.path ? 'bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
        >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
        </Link>
    ));

    const profileNavLink = (
        <Link
            to={profileItem.path}
            onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200 text-sm ${location.pathname === profileItem.path ? 'bg-gradient-to-r from-indigo-700 to-indigo-500 text-onPrimary shadow-md' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
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
                            <span className="text-onBackground hidden sm:inline">Tooty</span>
                        </Link>
                        <div className="hidden md:flex items-center ml-10">
                            <div className="flex items-baseline space-x-2">
                                {mainNavLinks}
                            </div>
                            {/* Time Studied Dropdown */}
                            <div className="relative ml-4" ref={timeDropdownRef}>
                                <button
                                    onClick={() => setTimeDropdownOpen(!isTimeDropdownOpen)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200 text-sm ${isTimeDropdownOpen ? 'bg-surface/80 text-onBackground' : 'text-onSurface hover:bg-surface/50 hover:text-onBackground'}`}
                                >
                                    <ClockIcon className="h-5 w-5"/>
                                    <span>Time Studied</span>
                                </button>
                                {isTimeDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-72 bg-surface rounded-lg shadow-xl p-4 animate-fadeInUp z-20 border border-gray-700">
                                        <button onClick={() => { openStudyModal(); setTimeDropdownOpen(false); }} className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold flex items-center gap-3 transition-transform hover:scale-105">
                                            <ClockIcon className="h-5 w-5"/>
                                            <span>Start a Study Session</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 flex-grow sm:flex-grow-0 ml-4">
                        <form onSubmit={handleSearch} className="relative flex-grow max-w-xs sm:flex-grow-0 sm:w-48">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Find users..."
                                className="bg-gray-700/50 text-onBackground placeholder-gray-400 rounded-full py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-gray-700 transition-all w-full"
                            />
                            <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <SearchIcon className="h-5 w-5 text-gray-400 hover:text-primary" />
                            </button>
                        </form>

                        <div className="hidden md:flex items-center gap-4">
                            {profileNavLink}
                            <button onClick={logout} className="p-2 rounded-full text-onSurface hover:text-primary hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-colors duration-200">
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
                           <button onClick={() => { openStudyModal(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-onSurface hover:bg-surface/50 hover:text-onBackground bg-yellow-500/20">
                                <ClockIcon className="h-5 w-5 text-yellow-400" />
                                <span>Start Study Session</span>
                           </button>
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

export default Header;