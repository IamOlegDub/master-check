'use client';
import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
export function ActionModal({
    title,
    children,
    onClose,
    busy = false,
    error,
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
    error?: string;
}) {
    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-[100] bg-[#18132e]/45 backdrop-blur-sm" />
                <Dialog.Popup className="fixed top-1/2 left-1/2 z-[101] max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-white text-ink shadow-2xl">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white p-5">
                        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                        <Dialog.Close
                            disabled={busy}
                            aria-label="Закрити вікно"
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-[#f0eef9] disabled:opacity-50"
                        >
                            <X size={20} />
                        </Dialog.Close>
                    </div>
                    {error && (
                        <p
                            role="alert"
                            className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
                        >
                            {error}
                        </p>
                    )}
                    <div className="p-5">{children}</div>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
export function ConfirmDialog({
    title,
    description,
    onConfirm,
    onClose,
    busy = false,
    error,
}: {
    title: string;
    description: string;
    onConfirm: () => void;
    onClose: () => void;
    busy?: boolean;
    error?: string;
}) {
    return (
        <ActionModal title={title} onClose={onClose} busy={busy} error={error}>
            <p className="text-sm text-subtle">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
                <button
                    disabled={busy}
                    className="rounded-xl border border-line px-4 py-3"
                    onClick={onClose}
                >
                    Скасувати
                </button>
                <button
                    disabled={busy}
                    className="rounded-xl bg-red-600 px-4 py-3 text-white disabled:opacity-50"
                    onClick={onConfirm}
                >
                    {busy ? 'Видаляємо…' : 'Видалити'}
                </button>
            </div>
        </ActionModal>
    );
}
