// FIX: Correctly import useState and useEffect from React. The previous import was syntactically incorrect.
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Core Components
import Header from './components/core/Header';
import LoadingScreen from './components/core/LoadingScreen';
import AnimatedShapes from './components/core/AnimatedShapes';

// Page Components
import AuthPage from './components/auth/AuthPage';
import HomePage from './components/dashboard/HomePage';
import ProfilePage from './components/profile/ProfilePage';
import GroupsPage from './components/groups/GroupsPage';
import RequestsPage from './components/requests/RequestsPage';
import MessagesPage from './components/messages/MessagesPage';
import GroupPage from './components/groups/GroupPage';
import UserProfilePage from './components/user/UserProfilePage';
import DiscoverPage from './components/discover/DiscoverPage';

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
    const { currentUser, loading: authLoading } = useAuth();
    const location = useLocation();
    
    const [isAestheticLoading, setIsAestheticLoading] = useState(true);
    const [displayedLocation, setDisplayedLocation] = useState(location);
    const [transitionClass, setTransitionClass] = useState('animate-fadeInUp');

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsAestheticLoading(false);
        }, 4000); // Should match loading screen fadeout duration
        return () => clearTimeout(timer);
    }, []);

    const isAppReady = !isAestheticLoading && !authLoading;

    useEffect(() => {
        if (isAppReady && location.pathname !== displayedLocation.pathname) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/discover', '/profile'];
            const oldIndex = routeOrder.indexOf(displayedLocation.pathname);
            const newIndex = routeOrder.indexOf(location.pathname);
            
            let outClass = 'animate-fadeOut';
            if (oldIndex > -1 && newIndex > -1) {
                outClass = newIndex > oldIndex ? 'animate-slideOutToLeft' : 'animate-slideOutToRight';
            }
            setTransitionClass(outClass);
        }
    }, [location, displayedLocation, isAppReady]);

    const handleAnimationEnd = () => {
        if (transitionClass.includes('Out') || transitionClass.includes('fadeOut')) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/discover', '/profile'];
            const oldIndex = routeOrder.indexOf(displayedLocation.pathname);
            const newIndex = routeOrder.indexOf(location.pathname);

            let inClass = 'animate-fadeInUp';
            if (oldIndex > -1 && newIndex > -1) {
                inClass = newIndex > oldIndex ? 'animate-slideInFromRight' : 'animate-slideInFromLeft';
            }
            
            setDisplayedLocation(location);
            setTransitionClass(inClass);
        }
    };

    if (!isAppReady) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-background relative app-background">
            <div className="animated-gradient"></div>
            <AnimatedShapes />
            <div className="relative z-10">
                {currentUser && <Header />}
                <main>
                    <div 
                        key={displayedLocation.pathname} 
                        className={transitionClass}
                        onAnimationEnd={handleAnimationEnd}
                    >
                        <Routes location={displayedLocation}>
                            <Route path="/auth" element={<AuthPage />} />
                            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                            <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                            <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                            <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
                            <Route path="/group/:id" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
                            <Route path="/user/:username" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                            <Route path="*" element={<Navigate to={currentUser ? "/" : "/auth"} />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;