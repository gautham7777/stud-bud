import React from 'react';
import { BookOpenIcon } from '../icons';

const LoadingScreen: React.FC = () => {
    const title = "Study Buddy";
    return (
        <div className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center" style={{ animation: `fadeOut 0.5s ease-out 3.5s forwards` }}>
            <div className="flex flex-col items-center gap-6 animate-fadeIn">
                <div style={{ animation: 'logo-float 4s ease-in-out infinite' }}>
                    <BookOpenIcon className="w-32 h-32 text-primary" />
                </div>
                <h1 className="text-5xl font-bold text-onBackground tracking-widest" style={{ animation: 'text-glow 3s ease-in-out infinite' }}>
                    {title.split("").map((char, index) => (
                        <span key={index} className="inline-block" style={{ animation: `letter-reveal 0.5s ease-out forwards`, animationDelay: `${0.5 + index * 0.1}s`, opacity: 0 }}>
                            {char === ' ' ? '\u00A0' : char}
                        </span>
                    ))}
                </h1>
            </div>
            <div className="absolute bottom-20 w-full max-w-sm px-4">
                <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-secondary h-2.5 rounded-full" style={{ animation: `progress-bar-load 3s ease-out forwards` }}></div>
                </div>
                <p className="text-center mt-2 text-onSurface/70">Initializing connections...</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
