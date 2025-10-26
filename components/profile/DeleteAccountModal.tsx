import React, { useState } from 'react';
import Modal from '../core/Modal';
import { useAuth } from '../auth/AuthProvider';
import { ExclamationTriangleIcon } from '../icons';

const DeleteAccountModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const { deleteAccount } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const canDelete = confirmText === 'DELETE' && password.length > 0;

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canDelete) return;

        setIsDeleting(true);
        setError('');

        try {
            await deleteAccount(password);
            // No need to close modal, the user will be logged out and redirected
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Incorrect password. Please try again.');
            } else {
                setError(err.message || 'An error occurred. Please try again.');
            }
            setIsDeleting(false);
        }
    };

    const handleClose = () => {
        // Reset state on close
        setPassword('');
        setConfirmText('');
        setError('');
        setIsDeleting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose}>
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 flex items-center justify-center bg-danger/20 rounded-full mb-4">
                    <ExclamationTriangleIcon className="w-10 h-10 text-danger" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-onBackground">Delete Account</h2>
                <p className="text-onSurface mb-6">
                    This action is permanent and cannot be undone. All your data, including your profile, messages, groups, and posts will be deleted forever.
                </p>
            </div>
            <form onSubmit={handleDelete} className="space-y-4">
                <div>
                    <label className="block font-semibold text-onSurface mb-1">
                        To confirm, please type "DELETE" below.
                    </label>
                    <input 
                        type="text" 
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-danger focus:border-danger placeholder:text-gray-500"
                        placeholder="DELETE"
                    />
                </div>
                <div>
                    <label className="block font-semibold text-onSurface mb-1">
                        Enter your password
                    </label>
                    <input 
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-onBackground focus:ring-danger focus:border-danger"
                    />
                </div>

                {error && <p className="text-danger text-sm text-center">{error}</p>}

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={handleClose} disabled={isDeleting} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md hover:bg-gray-500 transition disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={!canDelete || isDeleting} className="px-4 py-2 bg-danger text-white font-bold rounded-md hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        {isDeleting ? 'Deleting...' : 'Delete My Account'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DeleteAccountModal;