import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast.persistent && toast.duration !== 0) {
      const duration = toast.duration || (toast.type === 'loading' ? 0 : 5000);
      if (duration > 0) {
        const timer = setTimeout(() => handleClose(), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [toast.duration, toast.persistent, toast.type]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'loading':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "border-l-4 shadow-lg";
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-400`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-400`;
      case 'loading':
        return `${baseStyles} bg-blue-50 border-blue-400`;
      default:
        return `${baseStyles} bg-blue-50 border-blue-400`;
    }
  };

  return (
    <div
      className={`
        ${getStyles()}
        rounded-lg p-4 mb-3 transition-all duration-300 ease-in-out transform
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isExiting ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-gray-900">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="text-sm text-gray-600 mt-1">
              {toast.message}
            </p>
          )}
        </div>
        {!toast.persistent && toast.type !== 'loading' && (
          <button
            onClick={handleClose}
            className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const updateToast = (id: string, updates: Partial<ToastMessage>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const showSuccess = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'success', title, message, duration });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'error', title, message, duration });
  };

  const showInfo = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'info', title, message, duration });
  };

  const showLoading = (title: string, message?: string) => {
    return addToast({ type: 'loading', title, message, persistent: true });
  };

  return {
    toasts,
    addToast,
    removeToast,
    updateToast,
    clearAllToasts,
    showSuccess,
    showError,
    showInfo,
    showLoading
  };
};