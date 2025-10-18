
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from './AuthProvider';
import LoadingSpinner from '../core/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, loading } = useAuth();
    if (loading) {
        return <LoadingSpinner />;
    }
    if (!currentUser) {
        return <ReactRouterDOM.Navigate to="/auth" />;
    }
    return <>{children}</>;
};

export default ProtectedRoute;