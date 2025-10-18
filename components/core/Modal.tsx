import React from 'react';
import { createPortal } from 'react-dom';
import { XCircleIcon } from '../icons';

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ isOpen, onClose, children, className = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-surface rounded-lg p-6 shadow-2xl w-full border border-gray-700 animate-scaleIn relative ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-onSurface hover:text-danger transition-colors"
          aria-label="Close modal"
        >
          <XCircleIcon className="w-8 h-8" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
