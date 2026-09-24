'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { BusyIndicator } from '@/components/feedback';
import { Avatar } from '@/components/account-menu';
import { AvatarEditor } from '@/components/avatar-editor';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { profileFromUser, profileName, validateProfile, type Profile } from '@/lib/profile';
import {
    profileButton,
    profilePrimaryButton,
    profileInput,
    profileHelp,
} from '@/components/profile-styles';

export function ProfileSettings({
    profile,
    userId,
    onSaved,
}: {
    profile: Profile;
    userId: string;
    onSaved: (profile: Profile) => void;
}) {
    const [draft, setDraft] = useState(profile);
    const [file, setFile] = useState<File | null>(null);
    const [photo, setPhoto] = useState<Blob | null>(null);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [messageTarget, setMessageTarget] = useState<'photo' | 'profile'>('profile');
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!photo) {
            setPreview('');
            return;
        }
        const url = URL.createObjectURL(photo);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photo]);
    const avatar = preview || draft.avatarUrl;
    const photoChanged = !!photo || draft.avatarUrl !== profile.avatarUrl;
    function field(key: keyof Profile, value: string) {
        setDraft((current) => ({ ...current, [key]: value }));
    }
    function choosePhoto(selected?: File) {
        setMessageTarget('photo');
        setError('');
        setNotice('');
        if (!selected) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
            setError('Оберіть фото у форматі JPG, PNG або WebP.');
            return;
        }
        if (selected.size > 10 * 1024 * 1024) {
            setError('Фото має бути не більше 10 МБ.');
            return;
        }
        setFile(selected);
    }
    async function save(event?: FormEvent, photoOnly = false) {
        event?.preventDefault();
        if (saving.current) return;
        setMessageTarget(photoOnly ? 'photo' : 'profile');
        let next = {
            ...draft,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            phone: draft.phone.trim(),
            bio: draft.bio.trim(),
            email: draft.email.trim(),
        };
        const invalid = photoOnly ? null : validateProfile(next);
        if (invalid) {
            setError(invalid);
            return;
        }
        saving.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        let profileSaved = false;
        try {
            const supabase = createSupabaseBrowserClient();
            if (!supabase) throw new Error('З’єднання недоступне. Оновіть сторінку.');
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || auth.user?.id !== userId)
                throw new Error('Сесія змінилася. Оновіть сторінку та увійдіть знову.');
            const previous = profileFromUser(auth.user);
            if (photoOnly)
                next = { ...previous, avatarUrl: draft.avatarUrl, avatarPath: draft.avatarPath };
            if (photo) {
                const extension = photo.type === 'image/webp' ? 'webp' : 'png';
                next.avatarPath = `${userId}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(next.avatarPath, photo, {
                        contentType: photo.type,
                        cacheControl: '3600',
                        upsert: false,
                    });
                if (uploadError)
                    throw new Error(
                        'Не вдалося завантажити фото. Перевірте з’єднання та налаштування сховища avatars у Supabase.',
                    );
                next.avatarUrl = supabase.storage
                    .from('avatars')
                    .getPublicUrl(next.avatarPath).data.publicUrl;
            }
            const { email: requestedEmail, pendingEmail: _pending, ...metadata } = next;
            const { data, error: updateError } = await supabase.auth.updateUser({
                data: { mastercheck_profile: { ...metadata, updatedAt: new Date().toISOString() } },
            });
            if (updateError || !data.user)
                throw new Error(
                    'Не вдалося підтвердити збереження профілю. Оновіть сторінку перед повторною спробою.',
                );
            profileSaved = true;
            let saved = profileFromUser(data.user);
            onSaved(saved);
            setDraft((current) =>
                photoOnly
                    ? { ...current, avatarUrl: saved.avatarUrl, avatarPath: saved.avatarPath }
                    : saved,
            );
            setPhoto(null);
            // Only remove an old upload after the profile update is confirmed.
            if (
                previous.avatarPath &&
                previous.avatarPath !== next.avatarPath &&
                previous.avatarPath.startsWith(`${userId}/`)
            ) {
                await supabase.storage
                    .from('avatars')
                    .remove([previous.avatarPath])
                    .catch(() => undefined);
            }
            if (
                !photoOnly &&
                requestedEmail.toLowerCase() !== previous.email.toLowerCase() &&
                requestedEmail.toLowerCase() !== previous.pendingEmail.toLowerCase()
            ) {
                const { data: changed, error: emailError } = await supabase.auth.updateUser(
                    { email: requestedEmail },
                    { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` },
                );
                if (emailError || !changed.user) {
                    setDraft((current) => ({ ...current, email: requestedEmail }));
                    throw new Error(
                        'Профіль збережено, але зміну пошти не вдалося підтвердити. Перевірте адресу та спробуйте ще раз.',
                    );
                }
                saved = profileFromUser(changed.user);
                onSaved(saved);
                setDraft(saved);
                setNotice(
                    saved.email.toLowerCase() === requestedEmail.toLowerCase()
                        ? 'Профіль і пошту оновлено.'
                        : 'Профіль збережено. Перевірте поточну та нову пошту й підтвердьте зміну адреси.',
                );
            } else
                setNotice(
                    photoOnly
                        ? next.avatarUrl
                            ? 'Фото збережено.'
                            : 'Фото прибрано.'
                        : 'Профіль збережено.',
                );
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : profileSaved
                      ? 'Профіль збережено. Не вдалося завершити зміну пошти.'
                      : 'Не вдалося зберегти профіль. Перевірте з’єднання.',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="profile-settings grid grid-cols-1 items-start gap-5 min-[761px]:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] min-[761px]:gap-6">
            <BusyIndicator busy={busy} />
            <aside className="profile-photo-panel -mx-[18px] min-w-0 overflow-hidden rounded-none border border-t-0 border-line bg-white min-[761px]:mx-0 min-[761px]:rounded-2xl min-[761px]:border-t">
                {avatar ? (
                    <img
                        className="profile-photo block h-[33svh] w-full object-cover min-[761px]:mx-auto min-[761px]:mt-7 min-[761px]:size-[180px] min-[761px]:rounded-full"
                        src={avatar}
                        alt="Фото профілю"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="flex justify-center pt-7">
                        <Avatar name={profileName(draft)} className="size-[140px]! text-[42px]!" />
                    </div>
                )}
                <div className="px-[18px] py-5 min-[761px]:p-6">
                    <h2 className="text-base font-semibold">Ваше фото</h2>
                    <p className={profileHelp}>
                        JPG, PNG або WebP до 10 МБ. Перед збереженням оптимізуємо фото.
                    </p>
                    <input
                        ref={input}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Оберіть фото профілю"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                            choosePhoto(event.target.files?.[0]);
                            event.target.value = '';
                        }}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            className={profileButton}
                            type="button"
                            disabled={busy}
                            onClick={() => input.current?.click()}
                        >
                            <Camera size={17} />
                            {avatar ? 'Змінити фото' : 'Додати фото'}
                        </button>
                        {avatar && (
                            <button
                                className={profileButton}
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                    setMessageTarget('photo');
                                    setNotice('');
                                    setError('');
                                    setPhoto(null);
                                    setDraft((current) => ({
                                        ...current,
                                        avatarUrl: '',
                                        avatarPath: '',
                                    }));
                                }}
                            >
                                <Trash2 size={17} />
                                Прибрати
                            </button>
                        )}
                    </div>
                    {photoChanged && (
                        <div className="mt-3 grid gap-2">
                            <button
                                type="button"
                                className={profilePrimaryButton}
                                disabled={busy}
                                onClick={() => void save(undefined, true)}
                            >
                                {busy
                                    ? 'Зберігаємо…'
                                    : avatar
                                      ? 'Зберегти фото'
                                      : 'Підтвердити видалення фото'}
                            </button>
                            <button
                                type="button"
                                className={profileButton}
                                disabled={busy}
                                onClick={() => {
                                    setPhoto(null);
                                    setDraft((current) => ({
                                        ...current,
                                        avatarUrl: profile.avatarUrl,
                                        avatarPath: profile.avatarPath,
                                    }));
                                    setError('');
                                    setNotice('');
                                }}
                            >
                                Скасувати зміну фото
                            </button>
                            <p className={profileHelp}>Фото ще не збережено.</p>
                        </div>
                    )}
                    {messageTarget === 'photo' && notice && (
                        <p
                            role="status"
                            className="workspace-notice rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#34755c] bg-[#edf7f1] border border-[#d7eddf] mt-3"
                        >
                            {notice}
                        </p>
                    )}
                    {messageTarget === 'photo' && error && (
                        <p
                            role="alert"
                            className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0] mt-3"
                        >
                            {error}
                        </p>
                    )}
                </div>
            </aside>
            <form
                onSubmit={(event) => void save(event)}
                className="profile-form grid min-w-0 gap-6 rounded-2xl border border-line bg-white px-[18px] py-6 min-[761px]:p-7"
            >
                <div>
                    <span className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                        ОСОБИСТИЙ ПРОФІЛЬ
                    </span>
                    <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Налаштування</h1>
                    <p className={profileHelp}>Розкажіть трохи про себе та свою роботу.</p>
                </div>
                {messageTarget === 'profile' && notice && (
                    <p
                        role="status"
                        className="workspace-notice rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#34755c] bg-[#edf7f1] border border-[#d7eddf]"
                    >
                        {notice}
                    </p>
                )}
                {messageTarget === 'profile' && error && (
                    <p
                        role="alert"
                        className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0]"
                    >
                        {error}
                    </p>
                )}
                {profile.pendingEmail && (
                    <p className="workspace-notice rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#34755c] bg-[#edf7f1] border border-[#d7eddf]">
                        Очікує підтвердження: {profile.pendingEmail}. Поточна пошта —{' '}
                        {profile.email}.
                    </p>
                )}
                <fieldset
                    disabled={busy}
                    className="grid min-w-0 grid-cols-1 gap-5 text-xs text-[#55596c] min-[761px]:grid-cols-2 [&>label]:min-w-0"
                >
                    <label>
                        Ім’я <span className="text-brand">*</span>
                        <input
                            name="firstName"
                            autoComplete="given-name"
                            required
                            maxLength={80}
                            value={draft.firstName}
                            onChange={(event) => field('firstName', event.target.value)}
                            className={profileInput}
                        />
                    </label>
                    <label>
                        Прізвище
                        <input
                            name="lastName"
                            autoComplete="family-name"
                            maxLength={80}
                            value={draft.lastName}
                            onChange={(event) => field('lastName', event.target.value)}
                            className={profileInput}
                        />
                    </label>
                    <label className="col-span-full">
                        Електронна пошта <span className="text-brand">*</span>
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={draft.email}
                            onChange={(event) => field('email', event.target.value)}
                            className={profileInput}
                        />
                        <small className={profileHelp}>
                            Після зміни адреси може знадобитися підтвердження через пошту.
                        </small>
                    </label>
                    <label className="col-span-full">
                        Номер телефону
                        <input
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            maxLength={30}
                            placeholder="+380"
                            value={draft.phone}
                            onChange={(event) => field('phone', event.target.value)}
                            className={profileInput}
                        />
                        <small className={profileHelp}>
                            Необов’язково. Для зв’язку, поки без підтвердження номера.
                        </small>
                    </label>
                    <label className="col-span-full">
                        Про себе
                        <textarea
                            name="bio"
                            maxLength={600}
                            rows={5}
                            placeholder="Якими роботами займаєтеся, ваш досвід і підхід до роботи…"
                            value={draft.bio}
                            onChange={(event) => field('bio', event.target.value)}
                            className={`${profileInput} min-h-30 resize-y`}
                        />
                        <small className={profileHelp}>{draft.bio.length} / 600</small>
                    </label>
                </fieldset>
                <div className="flex flex-col gap-4 min-[761px]:flex-row min-[761px]:items-center min-[761px]:justify-between">
                    <small className={profileHelp}>* Обов’язкові поля</small>
                    <button className={profilePrimaryButton} disabled={busy} type="submit">
                        {busy ? 'Зберігаємо…' : 'Зберегти профіль'}
                    </button>
                </div>
            </form>
            {file && (
                <AvatarEditor
                    file={file}
                    onClose={() => setFile(null)}
                    onApply={(blob) => {
                        setPhoto(blob);
                        setFile(null);
                    }}
                />
            )}
        </section>
    );
}
