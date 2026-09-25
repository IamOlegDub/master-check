'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Video, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { inputClass, message } from '@/lib/workspace';
import { displayDate } from '@/lib/estimates';
import { BusyIndicator } from '@/components/feedback';
import { ConfirmDialog } from '@/components/action-modal';
export function OverviewVideo({
    path: initialPath,
    addedAt,
    owner = false,
    userId,
    projectId,
    albumId,
    onChanged,
}: {
    path?: string | null;
    addedAt?: string | null;
    owner?: boolean;
    userId?: string;
    projectId?: string;
    albumId?: string;
    onChanged?: () => void;
}) {
    const [path, setPath] = useState(initialPath),
        [url, setUrl] = useState(''),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [confirm, setConfirm] = useState(false),
        [retry, setRetry] = useState(0);
    const lock = useRef(false);
    useEffect(() => setPath(initialPath), [initialPath]);
    useEffect(() => {
        let live = true;
        setUrl('');
        if (path)
            void createSupabaseBrowserClient()
                ?.storage.from('overview-video')
                .createSignedUrl(path, 3600)
                .then((r) => {
                    if (!live) return;
                    if (r.error) setError('Не вдалося відкрити відео.');
                    else {
                        setUrl(r.data.signedUrl);
                        setError('');
                    }
                });
        return () => {
            live = false;
        };
    }, [path, retry]);
    async function save(next: string | null) {
        const c = createSupabaseBrowserClient();
        if (!c) throw Error('Немає з’єднання.');
        const r = await c.rpc('set_overview_video', {
            p_project_id: projectId ?? null,
            p_album_id: albumId ?? null,
            p_path: next,
        });
        if (r.error) throw r.error;
        setPath(next);
        if (r.data && r.data !== next) await c.storage.from('overview-video').remove([r.data]);
        onChanged?.();
    }
    async function upload(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        const form = e.currentTarget;
        let uploaded = '';
        try {
            const file = new FormData(form).get('video');
            if (
                !(file instanceof File) ||
                !file.size ||
                file.size > 50 * 1024 * 1024 ||
                !['video/mp4', 'video/webm'].includes(file.type)
            )
                throw Error('Оберіть MP4 або WebM до 50 МБ.');
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            uploaded = `${userId}/${projectId ? 'project' : 'album'}/${projectId ?? albumId}/${crypto.randomUUID()}.${file.type === 'video/mp4' ? 'mp4' : 'webm'}`;
            const r = await c.storage
                .from('overview-video')
                .upload(uploaded, file, { upsert: false, contentType: file.type });
            if (r.error) throw r.error;
            await save(uploaded);
            form.reset();
        } catch (e) {
            setError(message(e));
            if (uploaded)
                await createSupabaseBrowserClient()
                    ?.storage.from('overview-video')
                    .remove([uploaded]);
        } finally {
            setBusy(false);
            lock.current = false;
        }
    }
    async function remove() {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await save(null);
            setConfirm(false);
        } catch (e) {
            setError(message(e));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (!owner && !path) return null;
    return (
        <section className="mt-5 rounded-2xl border border-line bg-[var(--tone-bg-fafaff)] p-4 sm:p-5">
            <BusyIndicator busy={busy} label="Зберігаємо оглядове відео…" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold">
                    <Video size={19} className="text-brand" />
                    Оглядове відео
                </h3>
                {owner && path && (
                    <button
                        disabled={busy}
                        onClick={() => setConfirm(true)}
                        className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300"
                    >
                        <Trash2 size={16} />
                        Видалити відео
                    </button>
                )}
            </div>
            <p className="mt-2 text-xs leading-5 text-subtle">
                Один відеоогляд усього проєкту. MP4 (H.264) або WebM, до 50 МБ. Нове відео замінює
                попереднє.
            </p>
            {error && (
                <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
                    {error}{' '}
                    <button onClick={() => setRetry((x) => x + 1)} className="underline">
                        Оновити
                    </button>
                </p>
            )}
            {path &&
                (url ? (
                    <video
                        key={url}
                        src={url}
                        controls
                        playsInline
                        preload="metadata"
                        className="mt-4 max-h-[65svh] w-full rounded-xl bg-black"
                        onError={() =>
                            setError(
                                'Не вдалося відтворити відео. Спробуйте оновити посилання або використати MP4 (H.264).',
                            )
                        }
                    />
                ) : (
                    <div
                        role="status"
                        className="mt-4 grid h-40 place-items-center rounded-xl bg-[var(--tone-bg-eeedf5)] text-sm text-subtle"
                    >
                        Завантажуємо відео…
                    </div>
                ))}
            {path && addedAt && (
                <p className="mt-2 text-xs text-subtle">Додано {displayDate(addedAt)}</p>
            )}
            {owner && (
                <form onSubmit={upload} className="mt-4">
                    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <label className="min-w-0 text-xs">
                            {path ? 'Заміна відео' : 'Додати відеоогляд'}
                            <input
                                required
                                type="file"
                                name="video"
                                accept="video/mp4,video/webm"
                                className={inputClass}
                            />
                        </label>
                        <button
                            className="self-end rounded-xl bg-[var(--brand-solid)] px-4 py-3 text-sm text-white disabled:opacity-50"
                            type="submit"
                        >
                            {busy ? 'Завантажуємо…' : path ? 'Замінити відео' : 'Завантажити відео'}
                        </button>
                    </fieldset>
                </form>
            )}
            {confirm && (
                <ConfirmDialog
                    title="Видалити оглядове відео?"
                    description="Відео зникне з цього проєкту. Пізніше можна завантажити інше."
                    busy={busy}
                    error={error}
                    onClose={() => setConfirm(false)}
                    onConfirm={() => void remove()}
                />
            )}
        </section>
    );
}
