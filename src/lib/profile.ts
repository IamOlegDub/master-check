import type { User } from '@supabase/supabase-js';

export type Profile = { firstName: string; lastName: string; phone: string; bio: string; avatarUrl: string; avatarPath: string; email: string; pendingEmail: string };
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function profileFromUser(user: Pick<User, 'user_metadata' | 'email' | 'new_email'>): Profile {
    const meta = user.user_metadata ?? {};
    const saved = meta.mastercheck_profile ?? {};
    const parts = text(meta.full_name || meta.name).trim().split(/\s+/).filter(Boolean);
    return {
        firstName: text(saved.firstName ?? meta.given_name ?? parts[0]),
        lastName: text(saved.lastName ?? meta.family_name ?? parts.slice(1).join(' ')),
        phone: text(saved.phone), bio: text(saved.bio),
        avatarUrl: safeAvatarUrl(saved.avatarUrl ?? meta.avatar_url ?? meta.picture),
        avatarPath: text(saved.avatarPath),
        email: user.email ?? '', pendingEmail: user.new_email ?? '',
    };
}
export function safeAvatarUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    try { return new URL(value).protocol === 'https:' ? value : ''; } catch { return ''; }
}
export function profileName(profile: Profile) { return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Майстер'; }
export function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('uk-UA'); }
export function validateProfile(profile: Profile): string | null {
    if (!profile.firstName.trim()) return 'Вкажіть ім’я.';
    if (profile.firstName.trim().length > 80 || profile.lastName.trim().length > 80) return 'Ім’я та прізвище — до 80 символів кожне.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) || profile.email.length > 254) return 'Вкажіть коректну електронну пошту.';
    if (profile.phone && (!/^[+\d\s().-]+$/.test(profile.phone) || profile.phone.replace(/\D/g, '').length < 7 || profile.phone.length > 30)) return 'Перевірте номер телефону.';
    if (profile.bio.length > 600) return 'Опис — до 600 символів.';
    return null;
}
