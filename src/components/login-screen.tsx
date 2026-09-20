'use client';

import { useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginScreen({ configured }: { configured: boolean }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const signInWithGoogle = async () => {
        const supabase = createSupabaseBrowserClient();

        if (!supabase) {
            setError(
                'Додайте Supabase ключі у .env.local, щоб увімкнути вхід.',
            );
            return;
        }

        setIsLoading(true);
        setError('');

        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (authError) {
            setIsLoading(false);
            setError(
                'Не вдалося відкрити вхід через Google. Спробуйте ще раз.',
            );
        }
    };

    return (
        <main className="login-page">
            <div className="login-brand workspace-brand"><span className="brand-mark"><Sparkles size={20} /></span><span>Мій кошторис<span className="brand-caption">Простір майстра</span></span></div>
            <section className="login-card">
                <span className="login-welcome-icon"><Sparkles size={26} strokeWidth={1.5} /></span>
                <p className="eyebrow">МЕНШЕ РУТИНИ. БІЛЬШЕ ЗРОБЛЕНОГО.</p>
                <h1>Ваша робота.<br /><span>У вашому ритмі.</span></h1>
                <p className="login-description">Проєкти, клієнти та фінанси.<br />Один простір, щоб тримати все під контролем.</p>
                <Button onClick={signInWithGoogle} disabled={isLoading} className="workspace-primary login-button">
                    <span className="login-google" aria-hidden="true">G</span>
                    {isLoading ? 'Відкриваємо Google…' : 'Продовжити з Google'}
                    <ArrowRight size={17} />
                </Button>
                {!configured && <p className="workspace-error">Вхід ще налаштовується. Спробуйте трохи пізніше.</p>}
                {error && <p role="alert" className="workspace-error">{error}</p>}
                <div className="login-privacy"><ShieldCheck size={15} />Ваші проєкти доступні лише вам</div>
            </section>
            <p className="login-footer">Зосередьтеся на роботі. Решту впорядкуємо.</p>
        </main>
    );
}
