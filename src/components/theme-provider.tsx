'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; change: (theme: Theme) => void }>({
    theme: 'system',
    change: () => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('system');
    useEffect(() => {
        const media = matchMedia('(prefers-color-scheme: dark)');
        const sync = () => {
            let value: Theme = 'system';
            try {
                const saved = localStorage.getItem('master-check-theme');
                if (saved === 'light' || saved === 'dark') value = saved;
            } catch {}
            setTheme(value);
            const dark = value === 'dark' || (value === 'system' && media.matches);
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111522' : '#ffffff');
        };
        sync();
        media.addEventListener('change', sync);
        window.addEventListener('storage', sync);
        return () => {
            media.removeEventListener('change', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);
    const change = (value: Theme) => {
        setTheme(value);
        try {
            localStorage.setItem('master-check-theme', value);
        } catch {}
        const dark =
            value === 'dark' ||
            (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111522' : '#ffffff');
    };
    return <ThemeContext.Provider value={{ theme, change }}>{children}</ThemeContext.Provider>;
}
export function ThemePicker() {
    const { theme, change } = useContext(ThemeContext);
    return (
        <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium text-ink">Тема оформлення</legend>
            <div className="flex flex-wrap gap-2">
                {(
                    [
                        { value: 'light', label: 'Світла', Icon: Sun },
                        { value: 'dark', label: 'Темна', Icon: Moon },
                        { value: 'system', label: 'Як у системі', Icon: Monitor },
                    ] as const
                ).map(({ value, label, Icon }) => (
                    <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm text-ink focus-within:outline-2 focus-within:outline-brand has-checked:border-brand has-checked:bg-accent"
                    >
                        <input
                            className="sr-only"
                            type="radio"
                            name="appearance"
                            value={value}
                            checked={theme === value}
                            onChange={() => change(value)}
                        />
                        <Icon size={18} aria-hidden />
                        {label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
