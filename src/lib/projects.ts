export const projectStatuses = ['Очікує старту', 'В роботі', 'Завершено'] as const;

export type Project = {
    id: string;
    user_id: string;
    name: string;
    client: string;
    status: (typeof projectStatuses)[number];
    total: number;
    paid: number;
    created_at: string;
};

export function projectError(error: { code?: string } | null) {
    if (error?.code === 'PGRST205' || error?.code === '42P01') {
        return 'Сховище проєктів ще не налаштоване. Зверніться до адміністратора застосунку.';
    }
    if (error?.code === '42501') {
        return 'Немає доступу до проєктів. Увійдіть повторно або зверніться до адміністратора.';
    }
    return 'Не вдалося отримати доступ до проєктів. Перевірте з’єднання та спробуйте ще раз.';
}
