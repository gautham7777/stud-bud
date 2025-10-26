import React from 'react';
import { BookOpenIcon } from '../icons';

const LoadingScreen: React.FC = () => {
    const title = "Tooty";
    return (
        <div className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center" style={{ animation: `fadeOut 0.5s ease-out 5.5s forwards` }}>
            <div className="flex flex-col items-center gap-6 animate-fadeIn">
                <div style={{ animation: 'logo-float 4s ease-in-out infinite' }}>
                    <BookOpenIcon className="w-32 h-32 text-primary" />
                </div>
                <h1 className="text-5xl font-bold text-onBackground tracking-widest" style={{ animation: 'text-glow 3s ease-in-out infinite' }}>
                    {title.split("").map((char, index) => (
                        <span key={index} className="inline-block" style={{ animation: `letter-reveal 0.5s ease-out forwards`, animationDelay: `${1.5 + index * 0.15}s`, opacity: 0 }}>
                            {char}
                        </span>
                    ))}
                </h1>
            </div>
        </div>
    );
};

export default LoadingScreen;