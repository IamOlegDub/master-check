export type Role = 'MASTER' | 'CLIENT';
export const statusLabels = {
    DRAFT: 'Чернетка',
    PENDING_APPROVAL: 'На затвердженні',
    IN_PROGRESS: 'В роботі',
    COMPLETED: 'Завершено',
} as const;
export type WorkspaceProject = {
    id: string;
    slug?: string;
    owner_username?: string | null;
    overview_video_path?: string | null;
    overview_video_at?: string | null;
    user_id: string;
    name: string;
    client: string;
    client_id: string | null;
    status: keyof typeof statusLabels;
    total: number;
    paid: number;
    version: number;
    created_at: string;
    approved_at?: string | null;
    confirmed_total: number;
    advance_total: number;
    pending_count: number;
    progress: number;
};
export type Contact = { id: string; name: string; phone: string; notes: string };
export const inputClass =
    'mt-2 block w-full min-w-0 rounded-xl border border-line bg-white px-3 py-3 text-base text-ink outline-none focus:border-brand disabled:opacity-60';
export const panelClass = 'min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6';
export function message(error: unknown) {
    return error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Не вдалося виконати дію. Перевірте з’єднання.';
}
export function validId(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
