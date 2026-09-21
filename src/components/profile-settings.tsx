'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/account-menu';
import { AvatarEditor } from '@/components/avatar-editor';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { profileFromUser, profileName, validateProfile, type Profile } from '@/lib/profile';

export function ProfileSettings({ profile, userId, onSaved }: { profile: Profile; userId: string; onSaved: (profile: Profile) => void }) {
    const [draft, setDraft] = useState(profile);
    const [file, setFile] = useState<File | null>(null);
    const [photo, setPhoto] = useState<Blob | null>(null);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!photo) { setPreview(''); return; }
        const url = URL.createObjectURL(photo); setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photo]);
    const avatar = preview || draft.avatarUrl;
    function field(key: keyof Profile, value: string) { setDraft(current => ({ ...current, [key]: value })); }
    function choosePhoto(selected?: File) {
        setError(''); setNotice('');
        if (!selected) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError('Оберіть фото у форматі JPG, PNG або WebP.'); return; }
        if (selected.size > 10 * 1024 * 1024) { setError('Фото має бути не більше 10 МБ.'); return; }
        setFile(selected);
    }
    async function save(event: FormEvent) {
        event.preventDefault();
        if (saving.current) return;
        const next = { ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phone: draft.phone.trim(), bio: draft.bio.trim(), email: draft.email.trim() };
        const invalid = validateProfile(next);
        if (invalid) { setError(invalid); return; }
        saving.current = true; setBusy(true); setError(''); setNotice('');
        let profileSaved = false;
        try {
            const supabase = createSupabaseBrowserClient();
            if (!supabase) throw new Error('З’єднання недоступне. Оновіть сторінку.');
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || auth.user?.id !== userId) throw new Error('Сесія змінилася. Оновіть сторінку та увійдіть знову.');
            const previous = profileFromUser(auth.user);
            if (photo) {
                const extension = photo.type === 'image/webp' ? 'webp' : 'png';
                next.avatarPath = `${userId}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(next.avatarPath, photo, { contentType: photo.type, cacheControl: '3600', upsert: false });
                if (uploadError) throw new Error('Не вдалося завантажити фото. Перевірте з’єднання та налаштування сховища avatars у Supabase.');
                next.avatarUrl = supabase.storage.from('avatars').getPublicUrl(next.avatarPath).data.publicUrl;
            }
            const { email: requestedEmail, pendingEmail: _pending, ...metadata } = next;
            const { data, error: updateError } = await supabase.auth.updateUser({ data: { mastercheck_profile: { ...metadata, updatedAt: new Date().toISOString() } } });
            if (updateError || !data.user) throw new Error('Не вдалося підтвердити збереження профілю. Оновіть сторінку перед повторною спробою.');
            profileSaved = true;
            let saved = profileFromUser(data.user);
            onSaved(saved); setDraft(saved); setPhoto(null);
            // Only remove an old upload after the profile update is confirmed.
            if (previous.avatarPath && previous.avatarPath !== next.avatarPath && previous.avatarPath.startsWith(`${userId}/`)) {
                await supabase.storage.from('avatars').remove([previous.avatarPath]).catch(() => undefined);
            }
            if (requestedEmail.toLowerCase() !== previous.email.toLowerCase() && requestedEmail.toLowerCase() !== previous.pendingEmail.toLowerCase()) {
                const { data: changed, error: emailError } = await supabase.auth.updateUser({ email: requestedEmail }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` });
                if (emailError || !changed.user) {
                    setDraft(current => ({ ...current, email: requestedEmail }));
                    throw new Error('Профіль збережено, але зміну пошти не вдалося підтвердити. Перевірте адресу та спробуйте ще раз.');
                }
                saved = profileFromUser(changed.user); onSaved(saved); setDraft(saved);
                setNotice(saved.email.toLowerCase() === requestedEmail.toLowerCase() ? 'Профіль і пошту оновлено.' : 'Профіль збережено. Перевірте поточну та нову пошту й підтвердьте зміну адреси.');
            } else setNotice('Профіль збережено.');
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : profileSaved ? 'Профіль збережено. Не вдалося завершити зміну пошти.' : 'Не вдалося зберегти профіль. Перевірте з’єднання.');
        } finally { saving.current = false; setBusy(false); }
    }
    return <section className={`profile-settings ${avatar ? 'has-photo' : ''}`}>
        <aside className="profile-photo-panel workspace-panel">
            {avatar ? <img className="profile-photo" src={avatar} alt="Фото профілю" referrerPolicy="no-referrer" /> : <div className="profile-photo-placeholder"><Avatar name={profileName(draft)} /></div>}
            <div className="profile-photo-controls"><h2>Ваше фото</h2><p>JPG, PNG або WebP до 10 МБ. Перед збереженням оптимізуємо фото.</p>
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Оберіть фото профілю" className="sr-only" disabled={busy} onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
                <div className="profile-buttons"><button type="button" disabled={busy} onClick={() => input.current?.click()}><Camera size={17} />{avatar ? 'Змінити фото' : 'Додати фото'}</button>{avatar && <button type="button" disabled={busy} onClick={() => { setPhoto(null); setDraft(current => ({ ...current, avatarUrl: '', avatarPath: '' })); }}><Trash2 size={17} />Прибрати</button>}</div>
                <p>Зміни фото застосуються після збереження профілю.</p>
            </div>
        </aside>
        <form onSubmit={save} className="profile-form workspace-panel">
            <div><span className="eyebrow">ОСОБИСТИЙ ПРОФІЛЬ</span><h1>Налаштування</h1><p>Розкажіть трохи про себе та свою роботу.</p></div>
            {notice && <p role="status" className="workspace-notice">{notice}</p>}
            {error && <p role="alert" className="workspace-error">{error}</p>}
            {profile.pendingEmail && <p className="workspace-notice">Очікує підтвердження: {profile.pendingEmail}. Поточна пошта — {profile.email}.</p>}
            <fieldset disabled={busy} className="profile-fields">
                <label>Ім’я <span>*</span><input name="firstName" autoComplete="given-name" required maxLength={80} value={draft.firstName} onChange={event => field('firstName', event.target.value)} className="workspace-input" /></label>
                <label>Прізвище<input name="lastName" autoComplete="family-name" maxLength={80} value={draft.lastName} onChange={event => field('lastName', event.target.value)} className="workspace-input" /></label>
                <label className="profile-field-wide">Електронна пошта <span>*</span><input name="email" type="email" autoComplete="email" required maxLength={254} value={draft.email} onChange={event => field('email', event.target.value)} className="workspace-input" /><small>Після зміни адреси може знадобитися підтвердження через пошту.</small></label>
                <label className="profile-field-wide">Номер телефону<input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="+380" value={draft.phone} onChange={event => field('phone', event.target.value)} className="workspace-input" /><small>Необов’язково. Для зв’язку, поки без підтвердження номера.</small></label>
                <label className="profile-field-wide">Про себе<textarea name="bio" maxLength={600} rows={5} placeholder="Якими роботами займаєтеся, ваш досвід і підхід до роботи…" value={draft.bio} onChange={event => field('bio', event.target.value)} className="workspace-input" /><small>{draft.bio.length} / 600</small></label>
            </fieldset>
            <div className="profile-form-footer"><small>* Обов’язкові поля</small><button className="profile-save" disabled={busy} type="submit">{busy ? 'Зберігаємо…' : 'Зберегти профіль'}</button></div>
        </form>
        {file && <AvatarEditor file={file} onClose={() => setFile(null)} onApply={blob => { setPhoto(blob); setFile(null); }} />}
    </section>;
}
