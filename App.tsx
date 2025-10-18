
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';

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

const App: React.FC = () => {
    return (
        <AuthProvider>
            <ReactRouterDOM.HashRouter>
                <MainApp />
            </ReactRouterDOM.HashRouter>
        </AuthProvider>
    );
};

const MainApp: React.FC = () => {
    const { currentUser } = useAuth();
    const location = ReactRouterDOM.useLocation();
    
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [displayedLocation, setDisplayedLocation] = useState(location);
    const [transitionClass, setTransitionClass] = useState('animate-fadeInUp');

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsAppLoading(false);
        }, 4000); // Should match loading screen fadeout duration
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isAppLoading && location.pathname !== displayedLocation.pathname) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/profile'];
            const oldIndex = routeOrder.indexOf(displayedLocation.pathname);
            const newIndex = routeOrder.indexOf(location.pathname);
            
            let outClass = 'animate-fadeOut';
            if (oldIndex > -1 && newIndex > -1) {
                outClass = newIndex > oldIndex ? 'animate-slideOutToLeft' : 'animate-slideOutToRight';
            }
            setTransitionClass(outClass);
        }
    }, [location, displayedLocation, isAppLoading]);

    const handleAnimationEnd = () => {
        if (transitionClass.includes('Out') || transitionClass.includes('fadeOut')) {
            const routeOrder = ['/', '/groups', '/requests', '/messages', '/profile'];
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

    if (isAppLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-background relative">
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
                        <ReactRouterDOM.Routes location={displayedLocation}>
                            <ReactRouterDOM.Route path="/auth" element={<AuthPage />} />
                            <ReactRouterDOM.Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/group/:id" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="/user/:username" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                            <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to={currentUser ? "/" : "/auth"} />} />
                        </ReactRouterDOM.Routes>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;