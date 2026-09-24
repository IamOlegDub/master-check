'use client';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { PhotoGallery } from '@/components/photo-gallery';
import { ShareLink } from '@/components/share-link';
import { ConfirmDialog } from '@/components/action-modal';
import { BusyIndicator } from '@/components/feedback';
import { OverviewVideo } from '@/components/overview-video';
import { Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uploadPhotos } from '@/lib/photos';
import { inputClass, panelClass, message } from '@/lib/workspace';
type Album = {
    id: string;
    title: string;
    description: string;
    category_ids: string[];
    share_token: string;
    published: boolean;
    overview_video_path?: string | null;
    overview_video_at?: string | null;
};
type Photo = { id: string; album_id: string; path: string; caption: string };
export function PortfolioManager({
    initial,
    initialPhotos,
    categories,
    userId,
    publicToken,
    isPublic,
}: {
    initial: Album[];
    initialPhotos: Photo[];
    categories: { id: string; name: string }[];
    userId: string;
    publicToken: string;
    isPublic: boolean;
}) {
    const [albums, setAlbums] = useState(initial),
        [photos, setPhotos] = useState(initialPhotos),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [origin, setOrigin] = useState(''),
        [selected, setSelected] = useState<string[]>([]),
        [category, setCategory] = useState(''),
        [sharing, setSharing] = useState(isPublic),
        [token, setToken] = useState(publicToken),
        [deleting, setDeleting] = useState<{ album: Album; photo?: Photo; all?: boolean } | null>(
            null,
        );
    const [newAlbumOpen, setNewAlbumOpen] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [mediaOpen, setMediaOpen] = useState<Record<string, boolean>>({});
    async function reload() {
        const c = createSupabaseBrowserClient();
        if (!c) return;
        const [a, p] = await Promise.all([
            c.from('portfolio_albums').select('*').order('created_at', { ascending: false }),
            c.from('portfolio_photos').select('*').order('created_at'),
        ]);
        if (a.error || p.error) throw Error('Не вдалося оновити портфоліо.');
        setAlbums(a.data);
        setPhotos(p.data);
    }
    async function mutate(action: string, payload: Record<string, unknown>) {
        const c = createSupabaseBrowserClient();
        if (!c) throw Error('Немає з’єднання.');
        const r = await c.rpc('portfolio_action', { p_action: action, p_payload: payload });
        if (r.error) throw r.error;
        return r.data;
    }
    async function create(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        const form = e.currentTarget,
            fields = new FormData(form);
        try {
            await mutate('create', {
                title: String(fields.get('title')).trim(),
                description: fields.get('description'),
                category_ids: selected,
            });
            setSelected([]);
            setCategory('');
            form.reset();
            await reload();
            setNewAlbumOpen(false);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function upload(e: FormEvent<HTMLFormElement>, album: Album) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        const form = e.currentTarget,
            fields = new FormData(form);
        let uploaded: string[] = [];
        try {
            const files = fields
                .getAll('photos')
                .filter((f): f is File => f instanceof File && f.size > 0);
            if (!files.length || files.length > 10) throw Error('Оберіть від 1 до 10 фото за раз.');
            const paths = await uploadPhotos('portfolio', `${userId}/${album.id}`, files);
            uploaded = paths;
            for (const path of paths)
                await mutate('photo', { id: album.id, path, caption: fields.get('caption') });
            form.reset();
            await reload();
        } catch (e) {
            setError(message(e) + ' Оновіть список перед повторним завантаженням.');
            // Referenced files are protected by RLS; only orphan uploads are removed.
            if (uploaded.length)
                await createSupabaseBrowserClient()?.storage.from('portfolio').remove(uploaded);
            await reload().catch(() => {});
        } finally {
            setBusy(false);
        }
    }
    async function publish(album: Album) {
        setBusy(true);
        setError('');
        try {
            await mutate('publish', { id: album.id, published: !album.published });
            setOrigin(location.origin);
            await reload();
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function all() {
        setBusy(true);
        setError('');
        try {
            const r = await mutate('share_all', { published: !sharing });
            setToken(r.token);
            setSharing(!sharing);
            setOrigin(location.origin);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function remove(album: Album, photo?: Photo, all = false) {
        setBusy(true);
        setError('');
        try {
            const paths = photo
                ? [photo.path]
                : photos.filter((p) => p.album_id === album.id).map((p) => p.path);
            await mutate(photo ? 'remove_photo' : all ? 'remove_all_photos' : 'delete', {
                id: album.id,
                photo_id: photo?.id,
            });
            if (paths.length)
                await createSupabaseBrowserClient()?.storage.from('portfolio').remove(paths);
            await reload();
            if (!photo && !all && album.overview_video_path)
                await createSupabaseBrowserClient()
                    ?.storage.from('overview-video')
                    .remove([album.overview_video_path]);
            setDeleting(null);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <BusyIndicator busy={busy} label="Оновлюємо портфоліо…" />
            {deleting && (
                <ConfirmDialog
                    title={
                        deleting.photo
                            ? 'Видалити фото?'
                            : deleting.all
                              ? 'Видалити всі фото альбому?'
                              : `Видалити альбом «${deleting.album.title}»?`
                    }
                    description={
                        deleting.all
                            ? 'Усі фото цього альбому буде видалено. Альбом і оглядове відео залишаться.'
                            : 'Видалення неможливо скасувати. Збережіть оригінали, якщо вони вам потрібні.'
                    }
                    busy={busy}
                    error={error}
                    onClose={() => setDeleting(null)}
                    onConfirm={() => void remove(deleting.album, deleting.photo, deleting.all)}
                />
            )}
            <h1 className="text-3xl font-semibold">Портфоліо</h1>
            <p className="text-subtle">
                Створюйте альбоми й публікуйте лише ті, якими хочете ділитися. Фото оптимізуються до
                2048 px без обрізання.
            </p>
            {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
                    {error}
                </p>
            )}
            <section className={panelClass}>
                <h2 className="text-lg font-semibold">Посилання на все портфоліо</h2>
                <p className="my-3 text-xs text-subtle">
                    За ним видно тільки опубліковані альбоми. Після приховування й повторної
                    публікації адреса залишається тією самою.
                </p>
                <Button disabled={busy} variant="outline" onClick={() => void all()}>
                    {sharing ? 'Вимкнути публічне портфоліо' : 'Увімкнути публічне портфоліо'}
                </Button>
                {sharing &&
                    (origin ? (
                        <ShareLink url={`${origin}/share/${token}`} title="Моє портфоліо" />
                    ) : (
                        <button
                            className="ml-3 text-brand"
                            onClick={() => setOrigin(location.origin)}
                        >
                            Показати посилання
                        </button>
                    ))}
            </section>
            <Button
                variant="brand"
                className="justify-self-start"
                disabled={busy}
                aria-expanded={newAlbumOpen}
                aria-controls="new-album"
                onClick={() => setNewAlbumOpen(!newAlbumOpen)}
            >
                {newAlbumOpen ? 'Згорнути форму' : 'Додати альбом'}
            </Button>
            {newAlbumOpen && (
                <form id="new-album" onSubmit={create} className={panelClass}>
                    <h2 className="text-lg font-semibold">Новий альбом</h2>
                    <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label>
                            Назва
                            <input
                                name="title"
                                required
                                maxLength={160}
                                placeholder="Будинок у Бережанах"
                                className={inputClass}
                            />
                        </label>
                        <label>
                            Категорії послуг
                            <input
                                list="portfolio-categories"
                                className={inputClass}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Почніть вводити: плитка, меблі…"
                            />
                            <datalist id="portfolio-categories">
                                {categories.map((c) => (
                                    <option key={c.id} value={c.name} />
                                ))}
                            </datalist>
                            <button
                                type="button"
                                className="mt-2 text-brand"
                                onClick={() => {
                                    const found = categories.find((c) => c.name === category);
                                    if (found) {
                                        setSelected((s) => Array.from(new Set([...s, found.id])));
                                        setCategory('');
                                    }
                                }}
                            >
                                Додати категорію
                            </button>
                        </label>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                            {selected.map((id) => (
                                <button
                                    type="button"
                                    key={id}
                                    onClick={() => setSelected((s) => s.filter((x) => x !== id))}
                                    className="rounded-lg bg-[#efedfc] p-2 text-brand"
                                >
                                    {categories.find((c) => c.id === id)?.name} ×
                                </button>
                            ))}
                        </div>
                        <label className="sm:col-span-2">
                            Опис
                            <textarea name="description" maxLength={2000} className={inputClass} />
                        </label>
                        <Button type="submit" variant="brand">
                            Створити альбом
                        </Button>
                    </fieldset>
                </form>
            )}
            {!albums.length && <p className="text-subtle">Альбомів поки немає.</p>}
            {albums.map((album) => (
                <section key={album.id} className={panelClass}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold wrap-anywhere">{album.title}</h2>
                            <p className="mt-2 text-xs text-subtle">
                                {album.published ? 'Опубліковано' : 'Приватний альбом'} ·{' '}
                                {album.category_ids
                                    .map((id) => categories.find((c) => c.id === id)?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                            </p>
                        </div>
                        <div hidden={!expanded[album.id]} className="flex gap-2">
                            <Button
                                disabled={busy}
                                variant="outline"
                                onClick={() => void publish(album)}
                            >
                                {album.published ? 'Приховати' : 'Опублікувати'}
                            </Button>
                            <Button
                                disabled={busy}
                                variant="ghost"
                                onClick={() => setDeleting({ album })}
                            >
                                Видалити
                            </Button>
                        </div>
                    </div>
                    <p
                        className={`my-4 whitespace-pre-wrap wrap-anywhere text-subtle ${expanded[album.id] ? '' : 'line-clamp-1'}`}
                    >
                        {album.description}
                    </p>
                    {expanded[album.id] &&
                        album.published &&
                        (origin ? (
                            <ShareLink
                                url={`${origin}/share/${album.share_token}`}
                                title={album.title}
                            />
                        ) : (
                            <button
                                onClick={() => setOrigin(location.origin)}
                                className="text-brand"
                            >
                                Показати посилання
                            </button>
                        ))}
                    <PhotoGallery
                        bucket="portfolio"
                        preview={!expanded[album.id]}
                        photos={photos.filter((p) => p.album_id === album.id)}
                        busy={busy}
                        onDelete={(photo) =>
                            setDeleting({
                                album,
                                photo: photos.find((p) => p.path === photo.path)!,
                            })
                        }
                    />
                    <Button
                        variant="outline"
                        className="mt-4"
                        disabled={busy}
                        aria-expanded={!!expanded[album.id]}
                        aria-controls={`album-${album.id}`}
                        onClick={() => {
                            setExpanded((x) => ({ ...x, [album.id]: !x[album.id] }));
                            setMediaOpen((x) => ({ ...x, [album.id]: false }));
                        }}
                    >
                        {expanded[album.id]
                            ? 'Згорнути альбом'
                            : `Розгорнути альбом · ${photos.filter((p) => p.album_id === album.id).length} фото`}
                    </Button>
                    <div id={`album-${album.id}`} hidden={!expanded[album.id]}>
                        {photos.some((p) => p.album_id === album.id) && (
                            <button
                                disabled={busy}
                                onClick={() => setDeleting({ album, all: true })}
                                className="mt-4 flex items-center gap-2 text-xs text-red-700"
                            >
                                <Trash2 size={16} />
                                Видалити всі фото
                            </button>
                        )}
                        <Button
                            variant="outline"
                            className="mt-4"
                            disabled={busy}
                            aria-expanded={!!mediaOpen[album.id]}
                            aria-controls={`media-${album.id}`}
                            onClick={() =>
                                setMediaOpen((x) => ({ ...x, [album.id]: !x[album.id] }))
                            }
                        >
                            {mediaOpen[album.id] ? 'Закрити додавання медіа' : 'Додати медіа'}
                        </Button>
                        {expanded[album.id] && (
                            <OverviewVideo
                                path={album.overview_video_path}
                                addedAt={album.overview_video_at}
                                owner={!!mediaOpen[album.id]}
                                userId={userId}
                                albumId={album.id}
                                onChanged={() => void reload().catch((e) => setError(message(e)))}
                            />
                        )}
                        <div id={`media-${album.id}`} hidden={!mediaOpen[album.id]}>
                            <form
                                onSubmit={(e) => void upload(e, album)}
                                className="mt-5 border-t border-line pt-5"
                            >
                                <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
                                    <label>
                                        Фото (JPG / PNG / WebP, до 10 МБ кожне)
                                        <input
                                            name="photos"
                                            type="file"
                                            multiple
                                            accept="image/jpeg,image/png,image/webp"
                                            required
                                            className={inputClass}
                                        />
                                        <span className="mt-2 block text-xs text-subtle">
                                            Перед завантаженням фото стискається до 2048 px; у
                                            сховище потрапляє оптимізована копія.
                                        </span>
                                    </label>
                                    <label>
                                        Підпис
                                        <input
                                            name="caption"
                                            maxLength={500}
                                            className={inputClass}
                                        />
                                    </label>
                                    <Button type="submit" variant="brand">
                                        {busy ? 'Завантажуємо…' : 'Додати фото'}
                                    </Button>
                                </fieldset>
                            </form>
                        </div>
                    </div>
                </section>
            ))}
        </>
    );
}
