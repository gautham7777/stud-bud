import React from 'react';
import { User } from '../../types';

const Avatar: React.FC<{ user: User | null, className?: string}> = ({ user, className = 'w-10 h-10' }) => {
    if (!user) return <div className={`rounded-full bg-gray-700 ${className}`} />;

    if (user.photoURL) {
        return <img src={user.photoURL} alt={user.username} className={`rounded-full object-cover ${className}`} />;
    }
    
    const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];
    const color = colors[user.username.charCodeAt(0) % colors.length];

    return (
        <div className={`rounded-full flex items-center justify-center text-white font-bold ${color} ${className}`}>
            <span>{initial}</span>
        </div>
    );
};

export default Avatar;
