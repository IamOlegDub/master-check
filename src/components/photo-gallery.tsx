'use client';
import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import { MoreVertical, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export type GalleryPhoto = { path: string; caption?: string };
export function PhotoGallery({
    bucket,
    photos: allPhotos,
    preview = false,
    onDelete,
    busy = false,
}: {
    bucket: 'reports' | 'portfolio';
    photos: GalleryPhoto[];
    preview?: boolean;
    onDelete?: (photo: GalleryPhoto) => void;
    busy?: boolean;
}) {
    const [urls, setUrls] = useState<Record<string, string>>({}),
        [error, setError] = useState(''),
        [active, setActive] = useState<number | null>(null),
        [list, setList] = useState(false),
        [retry, setRetry] = useState(0);
    const photos = preview ? allPhotos.slice(0, 3) : allPhotos;
    const signature = photos.map((p) => p.path).join('|');
    useEffect(() => {
        let live = true;
        const c = createSupabaseBrowserClient();
        if (!signature) return;
        void c?.storage
            .from(bucket)
            .createSignedUrls(signature.split('|'), 300)
            .then((r) => {
                if (!live) return;
                if (r.error || r.data?.some((p) => p.error)) {
                    setError('Не вдалося відкрити фото. Оновіть галерею.');
                    return;
                }
                setError('');
                setUrls(
                    Object.fromEntries(
                        (r.data ?? [])
                            .filter((p) => p.path && p.signedUrl)
                            .map((p) => [p.path!, p.signedUrl!]),
                    ),
                );
            });
        return () => {
            live = false;
        };
    }, [signature, bucket, retry]);
    if (!photos.length) return null;
    return (
        <div className="mt-4">
            <div hidden={preview && !error} className="mb-3 flex gap-4 text-xs text-brand">
                <button hidden={preview} onClick={() => setList(!list)}>
                    {list ? 'Показати сіткою' : 'Показати списком'}
                </button>
                <button onClick={() => setRetry((x) => x + 1)}>Оновити фото</button>
            </div>
            {error && (
                <p role="alert" className="text-red-700 dark:text-red-300">
                    {error}
                </p>
            )}
            <div
                className={
                    list && !preview ? 'grid gap-4' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'
                }
            >
                {photos.map((photo, index) => (
                    <div
                        key={photo.path}
                        className={`relative min-w-0 ${preview && index === 2 ? 'hidden sm:block' : ''}`}
                    >
                        <button
                            type="button"
                            key={photo.path}
                            onClick={() => setActive(index)}
                            className="w-full overflow-hidden rounded-xl border border-line bg-card text-left"
                            aria-label={`Відкрити фото ${index + 1}`}
                        >
                            {urls[photo.path] ? (
                                <img
                                    src={urls[photo.path] || undefined}
                                    alt={photo.caption || `Фото роботи ${index + 1}`}
                                    loading="lazy"
                                    onError={() =>
                                        setError(
                                            'Не вдалося завантажити фото. Натисніть «Оновити фото».',
                                        )
                                    }
                                    className={
                                        list && !preview
                                            ? 'max-h-[65svh] w-full object-contain'
                                            : 'aspect-square w-full object-cover'
                                    }
                                />
                            ) : (
                                <div
                                    role="status"
                                    aria-label="Завантажуємо фото"
                                    className="aspect-square w-full bg-[var(--tone-bg-eeedf5)] motion-safe:animate-pulse"
                                />
                            )}
                            {!preview && photo.caption && (
                                <span className="block p-3 text-xs wrap-anywhere">
                                    {photo.caption}
                                </span>
                            )}
                        </button>
                        {onDelete && (
                            <Menu.Root>
                                <Menu.Trigger
                                    disabled={busy}
                                    aria-label={`Дії з фото ${index + 1}`}
                                    className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-card/95 text-ink shadow-sm"
                                >
                                    <MoreVertical size={20} />
                                </Menu.Trigger>
                                <Menu.Portal>
                                    <Menu.Positioner align="end" sideOffset={4} className="z-[110]">
                                        <Menu.Popup className="min-w-40 rounded-xl border border-line bg-card p-1.5 shadow-lg">
                                            <Menu.Item
                                                onClick={() => onDelete(photo)}
                                                className="flex cursor-pointer items-center gap-2 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 outline-none data-highlighted:bg-red-50 dark:bg-red-950"
                                            >
                                                <Trash2 size={17} />
                                                Видалити
                                            </Menu.Item>
                                        </Menu.Popup>
                                    </Menu.Positioner>
                                </Menu.Portal>
                            </Menu.Root>
                        )}
                    </div>
                ))}
            </div>
            <Dialog.Root
                open={active !== null}
                onOpenChange={(open) => {
                    if (!open) setActive(null);
                }}
            >
                <Dialog.Portal>
                    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85" />
                    <Dialog.Popup
                        className="fixed inset-3 z-[51] flex flex-col justify-center rounded-xl bg-black p-3 text-white"
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight')
                                setActive((x) => ((x ?? 0) + 1) % photos.length);
                            if (e.key === 'ArrowLeft')
                                setActive((x) => ((x ?? 0) - 1 + photos.length) % photos.length);
                        }}
                    >
                        <Dialog.Title className="sr-only">Перегляд фотографій</Dialog.Title>
                        <Dialog.Close className="absolute top-2 right-2 rounded-lg bg-card px-4 py-3 text-ink">
                            Закрити
                        </Dialog.Close>
                        {onDelete && active !== null && photos[active] && (
                            <button
                                disabled={busy}
                                aria-label="Видалити це фото"
                                className="absolute top-2 left-2 flex size-12 items-center justify-center rounded-xl bg-card/15 text-white hover:bg-red-600 dark:bg-red-950"
                                onClick={() => {
                                    const photo = photos[active];
                                    setActive(null);
                                    onDelete(photo);
                                }}
                            >
                                <Trash2 size={21} />
                            </button>
                        )}
                        {active !== null && (
                            <img
                                className="max-h-[78svh] w-full object-contain"
                                alt={photos[active]?.caption || 'Фото виконаних робіт'}
                                src={urls[photos[active]?.path] || undefined}
                            />
                        )}
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                className="p-3"
                                onClick={() =>
                                    setActive((x) => ((x ?? 0) - 1 + photos.length) % photos.length)
                                }
                            >
                                ← Попереднє
                            </button>
                            <span>
                                {(active ?? 0) + 1} / {photos.length}
                            </span>
                            <button
                                className="p-3"
                                onClick={() => setActive((x) => ((x ?? 0) + 1) % photos.length)}
                            >
                                Наступне →
                            </button>
                        </div>
                    </Dialog.Popup>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
