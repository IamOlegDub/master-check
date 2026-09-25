'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import Cropper from 'react-easy-crop';
import { cropAvatar, type CropArea } from '@/lib/avatar-image';
import { profileButton, profilePrimaryButton } from '@/components/profile-styles';

export function AvatarEditor({
    file,
    onClose,
    onApply,
}: {
    file: File;
    onClose: () => void;
    onApply: (blob: Blob) => void;
}) {
    const [source, setSource] = useState('');
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<CropArea | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSource(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    async function apply() {
        if (!area || busy) return;
        setBusy(true);
        setError('');
        try {
            onApply(await cropAvatar(source, area));
        } catch {
            setError('Не вдалося обробити фото. Спробуйте JPG, PNG або WebP.');
        } finally {
            setBusy(false);
        }
    }
    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-[250] bg-[#181526]/60" />
                <Dialog.Popup className="avatar-editor fixed top-1/2 left-1/2 z-[251] flex max-h-[calc(100dvh-24px)] w-[min(460px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-card p-5">
                    <Dialog.Title className="text-xl font-semibold">Налаштуйте фото</Dialog.Title>
                    <Dialog.Description className="mt-2 mb-4 text-xs leading-relaxed text-subtle">
                        Пересуньте фото й оберіть масштаб. Коло показує, як виглядатиме аватарка.
                    </Dialog.Description>
                    <div className="avatar-crop-area relative h-[min(320px,38dvh)] shrink-0 overflow-hidden rounded-xl bg-[#242331]">
                        {source && (
                            <Cropper
                                image={source}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_, pixels) => setArea(pixels)}
                                mediaProps={{
                                    onError: () =>
                                        setError(
                                            'Це фото не вдалося відкрити. Спробуйте JPG, PNG або WebP.',
                                        ),
                                }}
                            />
                        )}
                    </div>
                    <label className="mt-4 grid gap-2 text-xs">
                        Масштаб
                        <input
                            className="min-h-8 w-full accent-brand"
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={(event) => setZoom(Number(event.target.value))}
                        />
                    </label>
                    {error && (
                        <p
                            role="alert"
                            className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[var(--tone-text-a14752)] bg-[var(--tone-bg-fcf0f1)] border border-[var(--tone-border-f1dce0)]"
                        >
                            {error}
                        </p>
                    )}
                    <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 bg-card pt-2">
                        <button
                            className={profileButton}
                            type="button"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Скасувати
                        </button>
                        <button
                            type="button"
                            className={profilePrimaryButton}
                            disabled={!area || busy || !!error}
                            onClick={() => void apply()}
                        >
                            {busy ? 'Обробляємо…' : 'Підтвердити кадрування'}
                        </button>
                    </div>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
