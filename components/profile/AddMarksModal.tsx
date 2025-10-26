import React, { useState } from 'react';
import Modal from '../core/Modal';
import { ALL_SUBJECTS } from '../../constants';

const AddMarksModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (subjectId: number, examName: string, marksObtained: number, totalMarks: number) => Promise<void>;
}> = ({ isOpen, onClose, onAdd }) => {
    const [examName, setExamName] = useState('');
    const [marksObtained, setMarksObtained] = useState<string>('');
    const [totalMarks, setTotalMarks] = useState<string>('');
    const [subjectId, setSubjectId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!subjectId) {
            setError('Please select a subject.');
            return;
        }
        if (!examName.trim()) {
            setError('Please enter the exam name.');
            return;
        }
        const obtained = parseFloat(marksObtained);
        const total = parseFloat(totalMarks);

        if (isNaN(obtained) || isNaN(total) || obtained < 0 || total <= 0) {
            setError('Please enter valid positive numbers for marks.');
            return;
        }
        if (obtained > total) {
            setError('Marks obtained cannot be greater than total marks.');
            return;
        }

        setIsSubmitting(true);
        await onAdd(subjectId, examName.trim(), obtained, total);
        setIsSubmitting(false);
        // Reset form
        setExamName('');
        setMarksObtained('');
        setTotalMarks('');
        setSubjectId(null);
        onClose();
    };
    
    const inputClasses = "w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-primary focus:border-primary";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-onBackground">Add Your Marks</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block font-semibold text-onSurface mb-2">Subject</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {ALL_SUBJECTS.map(subject => (
                            <div key={subject.id} onClick={() => setSubjectId(subject.id)}
                                className={`text-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${subjectId === subject.id ? 'border-primary bg-primary/20 scale-105' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'}`}>
                                <span>{subject.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="block font-semibold text-onSurface">Exam Name</label>
                    <input type="text" value={examName} onChange={e => setExamName(e.target.value)} required className={inputClasses} placeholder="e.g., Midterm 1, Final Exam" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block font-semibold text-onSurface">Marks Obtained</label>
                        <input type="number" value={marksObtained} onChange={e => setMarksObtained(e.target.value)} required className={inputClasses} placeholder="e.g., 85" />
                    </div>
                    <div>
                        <label className="block font-semibold text-onSurface">Out of (Total Marks)</label>
                        <input type="number" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} required className={inputClasses} placeholder="e.g., 100" />
                    </div>
                </div>
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-md hover:from-amber-500 hover:to-amber-400 transition disabled:opacity-50">
                        {isSubmitting ? 'Adding...' : 'Add Mark'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddMarksModal;