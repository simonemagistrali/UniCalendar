import React from 'react';
import { X } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      <GlassPanel className="relative w-full max-w-lg z-10 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="ghost" className="!p-2 rounded-full" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        <div>
          {children}
        </div>
      </GlassPanel>
    </div>
  );
}
