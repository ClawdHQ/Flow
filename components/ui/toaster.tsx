'use client';

import * as React from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

interface ToastContextType {
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 5000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  const variants: Record<string, string> = {
    default: 'bg-card border-border',
    destructive: 'bg-red-950 border-red-800',
    success: 'bg-emerald-950 border-emerald-800',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`rounded-lg border p-4 shadow-xl animate-in slide-in-from-right-full ${variants[t.variant ?? 'default']}`}
          onClick={() => dismiss(t.id)}
        >
          <p className="text-sm font-semibold">{t.title}</p>
          {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
        </div>
      ))}
    </div>
  );
}
