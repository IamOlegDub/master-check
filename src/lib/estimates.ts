import type { Project } from './projects';
import type { ServiceUnit } from './price-list';

export type EstimateItem = {
    id: string;
    project_id: string;
    service_id: string | null;
    name: string;
    category_name: string;
    unit: ServiceUnit;
    quantity: number;
    unit_price: number;
    adjustment_percent: number;
    line_total: number;
    paid_amount: number;
    note: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};
export type ProjectPayment = {
    id: string;
    project_id: string;
    kind: 'advance' | 'item';
    amount: number;
    occurred_at: string | null;
    recorded_at: string;
    note: string;
    voided_at: string | null;
    void_reason: string | null;
};
export type PaymentAllocation = {
    id: string;
    payment_id: string;
    item_id: string;
    amount: number;
    occurred_at: string;
    recorded_at: string;
    released_at: string | null;
};
export type ProjectEvent = {
    id: string;
    action: string;
    occurred_at: string | null;
    recorded_at: string;
    details: Record<string, unknown>;
};
export type ProjectDetail = {
    project: Project & { version: number; updated_at: string };
    items: EstimateItem[];
    payments: ProjectPayment[];
    allocations: PaymentAllocation[];
    events: ProjectEvent[];
};

function scaled(value: string, precision: number) {
    if (!new RegExp(`^-?\\d+(?:\\.\\d{1,${precision}})?$`).test(value)) return null;
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return BigInt(whole + fraction.padEnd(precision, '0')) * BigInt(negative ? -1 : 1);
}

// Integer arithmetic uses the same half-up rounding as PostgreSQL numeric.
export function calculateLineTotal(quantity: string, price: string, adjustment: string) {
    const q = scaled(quantity, 3),
        p = scaled(price, 2),
        a = scaled(adjustment, 2);
    if (
        q === null ||
        p === null ||
        a === null ||
        q <= BigInt(0) ||
        q > BigInt('999999999999') ||
        p < BigInt(0) ||
        p > BigInt('999999999999') ||
        a < BigInt(-10000) ||
        a > BigInt(100000)
    )
        return null;
    const cents = (q * p * (BigInt(10000) + a) + BigInt(5000000)) / BigInt(10000000);
    return cents <= BigInt('999999999999') ? Number(cents) / 100 : null;
}

export function projectBalance(detail: ProjectDetail) {
    const active = new Set(detail.payments.filter((p) => !p.voided_at).map((p) => p.id));
    const allocatedCents = detail.allocations
        .filter((a) => !a.released_at && active.has(a.payment_id))
        .reduce((sum, a) => sum + Math.round(Number(a.amount) * 100), 0);
    const paidCents = Math.round(Number(detail.project.paid) * 100);
    const totalCents = Math.round(Number(detail.project.total) * 100);
    return {
        unallocated: (paidCents - allocatedCents) / 100,
        remaining: Math.max(0, totalCents - paidCents) / 100,
        overpaid: Math.max(0, paidCents - totalCents) / 100,
    };
}

export function localDateTime(value = new Date()) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
export function displayDate(value: string | null) {
    if (!value) return 'Точна дата невідома';
    return new Date(value).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
}
export function estimateError(error: { code?: string; message?: string }) {
    if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01')
        return 'Деталізований кошторис ще не налаштований у базі. Зверніться до адміністратора.';
    if (error.code === '42501') return 'Проєкт недоступний. Увійдіть повторно.';
    if (error.code === 'P0001' || error.code === '40001')
        return error.message ?? 'Оновіть проєкт та повторіть дію.';
    if (error.code === '22003' || error.code === '23514' || error.code === '22P02')
        return 'Перевірте суми, кількість і дату: значення завелике або некоректне.';
    return 'Не вдалося підтвердити збереження. Повторіть той самий запит або оновіть дані перед наступною дією.';
}
export const eventLabels: Record<string, string> = {
    import: 'Перенесено початкові суми',
    add_item: 'Додано роботу',
    edit_item: 'Змінено роботу',
    delete_item: 'Видалено роботу',
    complete_item: 'Змінено виконання',
    payment: 'Отримано оплату',
    allocate: 'Аванс зараховано на роботу',
    release_advance: 'Аванс повернено до нерозподіленого залишку',
    void_payment: 'Скасовано помилкову оплату',
    status: 'Змінено статус проєкту',
};
