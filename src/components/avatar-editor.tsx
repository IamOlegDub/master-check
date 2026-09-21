'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import Cropper from 'react-easy-crop';
import { cropAvatar, type CropArea } from '@/lib/avatar-image';

export function AvatarEditor({ file, onClose, onApply }: { file: File; onClose: () => void; onApply: (blob: Blob) => void }) {
    const [source, setSource] = useState('');
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<CropArea | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { const url = URL.createObjectURL(file); setSource(url); return () => URL.revokeObjectURL(url); }, [file]);
    async function apply() {
        if (!area || busy) return;
        setBusy(true); setError('');
        try { onApply(await cropAvatar(source, area)); }
        catch { setError('Не вдалося обробити фото. Спробуйте JPG, PNG або WebP.'); }
        finally { setBusy(false); }
    }
    return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
        <Dialog.Portal><Dialog.Backdrop className="avatar-editor-backdrop" /><Dialog.Popup className="avatar-editor">
            <Dialog.Title>Налаштуйте фото</Dialog.Title>
            <Dialog.Description>Пересуньте фото й оберіть масштаб. Коло показує, як виглядатиме аватарка.</Dialog.Description>
            <div className="avatar-crop-area">{source && <Cropper image={source} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} mediaProps={{ onError: () => setError('Це фото не вдалося відкрити. Спробуйте JPG, PNG або WebP.') }} />}</div>
            <label className="avatar-zoom">Масштаб<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
            {error && <p role="alert" className="workspace-error">{error}</p>}
            <div className="profile-buttons"><button type="button" disabled={busy} onClick={onClose}>Скасувати</button><button type="button" className="profile-save" disabled={!area || busy || !!error} onClick={() => void apply()}>{busy ? 'Обробляємо…' : 'Застосувати фото'}</button></div>
        </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>;
}
