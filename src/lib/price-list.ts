export const serviceUnits = {
    m2: 'м²',
    lm: 'пог. м',
    m3: 'м³',
    piece: 'шт.',
    hour: 'год',
    day: 'день',
    set: 'комплект',
    service: 'послуга',
    kg: 'кг',
    tonne: 'т',
} as const;
export type ServiceUnit = keyof typeof serviceUnits;
export type ServiceCategory = { id: string; user_id: string; name: string; created_at: string };
export type Service = {
    id: string;
    user_id: string;
    category_id: string;
    name: string;
    price: number;
    unit: ServiceUnit;
    created_at: string;
};
export type ServiceSort = 'category' | 'name' | 'price-asc' | 'price-desc';

export function formatPrice(value: number) {
    const [whole, fraction] = Number(value).toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction}\u00a0₴`;
}

export function selectServices(
    services: Service[],
    categories: ServiceCategory[],
    categoryId: string,
    query: string,
    sort: ServiceSort,
) {
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const search = query.trim().toLocaleLowerCase('uk-UA');
    const compare = (a: string, b: string) => a.localeCompare(b, 'uk-UA');
    return services
        .filter(
            (service) =>
                (!categoryId || service.category_id === categoryId) &&
                `${service.name} ${names.get(service.category_id) ?? ''}`
                    .toLocaleLowerCase('uk-UA')
                    .includes(search),
        )
        .sort((a, b) => {
            const byName = compare(a.name, b.name) || a.id.localeCompare(b.id);
            if (sort === 'price-asc') return Number(a.price) - Number(b.price) || byName;
            if (sort === 'price-desc') return Number(b.price) - Number(a.price) || byName;
            if (sort === 'name') return byName;
            return (
                compare(names.get(a.category_id) ?? '', names.get(b.category_id) ?? '') || byName
            );
        });
}

export function validateService(name: string, price: string, unit: string, categoryId: string) {
    if (!name.trim() || name.trim().length > 160) return 'Вкажіть назву послуги до 160 символів.';
    if (!categoryId) return 'Оберіть категорію послуги.';
    if (!Object.prototype.hasOwnProperty.call(serviceUnits, unit))
        return 'Оберіть одиницю виміру зі списку.';
    if (
        !/^\d+(\.\d{1,2})?$/.test(price) ||
        !Number.isFinite(Number(price)) ||
        Number(price) > 9999999999.99
    ) {
        return 'Вкажіть невід’ємну ціну з точністю до копійок.';
    }
    return null;
}

export function priceListError(error: { code?: string }) {
    if (error.code === 'PGRST205' || error.code === '42P01')
        return 'Прайс-лист ще не налаштований у базі. Зверніться до адміністратора застосунку.';
    if (error.code === '23505') return 'Категорія з такою назвою вже існує.';
    if (error.code === '23503')
        return 'Категорія змінилася або містить послуги. Оновіть список; перед видаленням категорії перенесіть її послуги.';
    if (error.code === '42501' || error.code === 'PGRST116')
        return 'Запис недоступний. Оновіть список або увійдіть повторно.';
    return 'Не вдалося виконати дію. Перевірте з’єднання й оновіть список перед повторною спробою.';
}
