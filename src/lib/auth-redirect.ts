export function safeReturnPath(value: string | null | undefined) {
    if (
        !value ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        /[\\\r\n]/.test(value) ||
        value.length > 2048
    )
        return '/';
    try {
        const url = new URL(value, 'https://local.invalid');
        return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : '/';
    } catch {
        return '/';
    }
}
