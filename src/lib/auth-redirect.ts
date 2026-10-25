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

// A temporary auth outage must not look like a logout: keep the session and let the user retry.
export function isTemporaryAuthError(error: { name?: string; status?: number } | null) {
    return (
        !!error &&
        (error.name === 'AuthRetryableFetchError' ||
            error.status === 429 ||
            (error.status ?? 0) >= 500)
    );
}
