import React, { useState } from 'react';
import Modal from '../core/Modal';

const ScheduleSessionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (topic: string, scheduledAt: number) => void;
}> = ({ isOpen, onClose, onSchedule }) => {
    const [topic, setTopic] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!topic.trim() || !date || !time) {
            setError('All fields are required.');
            return;
        }

        const scheduledDateTime = new Date(`${date}T${time}`);
        if (scheduledDateTime.getTime() <= Date.now()) {
            setError('Please select a future date and time.');
            return;
        }

        onSchedule(topic, scheduledDateTime.getTime());
        setTopic('');
        setDate('');
        setTime('');
    };
    
    // Set min date for the date input to today
    const today = new Date().toISOString().split('T')[0];

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-onBackground">Schedule Study Session</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-onSurface">Topic</label>
                    <input
                        type="text"
                        id="topic"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-onBackground focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="e.g., Chapter 5 Review"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-onSurface">Date</label>
                        <input
                            type="date"
                            id="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            min={today}
                            className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-onBackground focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="time" className="block text-sm font-medium text-onSurface">Time</label>
                        <input
                            type="time"
                            id="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-onBackground focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-gradient-to-r from-secondary to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition">
                        Schedule
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ScheduleSessionModal;