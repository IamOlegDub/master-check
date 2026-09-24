const letters: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'h',
    ґ: 'g',
    д: 'd',
    е: 'e',
    ж: 'zh',
    з: 'z',
    и: 'y',
    і: 'i',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ь: '',
    "'": '',
    '’': '',
};
export function projectSlug(name: string) {
    const source = Array.from(name.trim().toLowerCase());
    return source
        .map((c, i) => {
            const initial = i === 0 || !/[a-zа-яіїєґ0-9]/.test(source[i - 1]);
            const special: Record<string, string> = {
                є: initial ? 'ye' : 'ie',
                ї: initial ? 'yi' : 'i',
                й: initial ? 'y' : 'i',
                ю: initial ? 'yu' : 'iu',
                я: initial ? 'ya' : 'ia',
            };
            return special[c] ?? letters[c] ?? c;
        })
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 100)
        .replace(/^-+|-+$/g, '');
}
export function projectHref(project: {
    id: string;
    slug?: string;
    owner_username?: string | null;
}) {
    return project.owner_username && project.slug
        ? `/${project.owner_username}/${project.slug}`
        : `/projects/${project.id}`;
}
