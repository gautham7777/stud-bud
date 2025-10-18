import React, { useState, useEffect } from 'react';
import Modal from '../core/Modal';
import { ClockIcon } from '../icons';

const StudySessionModal: React.FC<{
    isOpen: boolean;
    onClose: (durationInSeconds: number) => void;
}> = ({ isOpen, onClose }) => {
    const [timeElapsed, setTimeElapsed] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setTimeElapsed(0); // Reset timer when closed
            return;
        }

        const timerId = setInterval(() => {
            setTimeElapsed(prevTime => prevTime + 1);
        }, 1000);

        return () => {
            clearInterval(timerId);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // When the user tabs out, reset the timer to enforce active focus
                setTimeElapsed(0);
            }
        };

        if (isOpen) {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isOpen]);

    const formatTime = (totalSeconds: number): string => {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const handleEndSession = () => {
        onClose(timeElapsed);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleEndSession} 
            className="max-w-2xl text-center"
            showCloseButton={false}
        >
            <div className="flex flex-col items-center gap-4">
                <ClockIcon className="w-24 h-24 text-amber-400 animate-pulse" />
                <h2 className="text-3xl font-bold text-onBackground">Study Session in Progress</h2>
                <p className="text-onSurface">Stay focused! Every second counts.</p>
                <div className="my-6 p-6 bg-background rounded-lg border border-gray-700">
                    <p className="text-6xl font-mono font-bold text-amber-300 tracking-wider">
                        {formatTime(timeElapsed)}
                    </p>
                </div>
                <button 
                    onClick={handleEndSession}
                    className="w-full max-w-xs px-6 py-3 bg-gradient-to-r from-danger to-rose-600 text-white font-semibold text-lg rounded-lg hover:from-rose-600 hover:to-rose-500 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-danger/30"
                >
                    End Session
                </button>
            </div>
        </Modal>
    );
};

export default StudySessionModal;