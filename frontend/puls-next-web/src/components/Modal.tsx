import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, title, onClose, children, actions, maxWidth = 960 }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.classList.add('modal-open');
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-window"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id={titleId}>{title}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>,
    document.body
  );
}
