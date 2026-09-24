'use client';

import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginScreen({
    configured,
    nextPath = '/',
}: {
    configured: boolean;
    nextPath?: string;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const signInWithGoogle = async () => {
        const supabase = createSupabaseBrowserClient();

        if (!supabase) {
            setError('Додайте Supabase ключі у .env.local, щоб увімкнути вхід.');
            return;
        }

        setIsLoading(true);
        setError('');

        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
        });

        if (authError) {
            setIsLoading(false);
            setError('Не вдалося відкрити вхід через Google. Спробуйте ще раз.');
        }
    };

    return (
        <main className="login-page text-ink [background:radial-gradient(ellipse_at_50%_35%,_#efedf9_0%,_#f7f8fb_65%)] min-h-dvh text-[14px] tracking-[-.015em] [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_:is(button,_a):focus-visible]:[outline:3px_solid_#a59ced] [&_:is(button,_a):focus-visible]:[outline-offset:3px] motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:animate-none! flex flex-col items-center justify-center pt-25 px-5 pb-15">
            <div className="login-brand absolute top-8 left-10 max-[481px]:left-5.5 max-[481px]:top-[23px] workspace-brand flex items-center gap-[11px] text-ink font-[650] text-[15px] no-underline">
                <BrandLogo decorative className="size-11" />
                <span>
                    Мій кошторис
                    <span className="brand-caption block text-subtle font-normal text-[11px] mt-[3px]">
                        Простір майстра
                    </span>
                </span>
            </div>
            <section className="login-card w-full max-w-107.5 p-10 border border-[#e8e5f0] rounded-[20px] bg-[#ffffffed] shadow-[0_20px_70px_#39314a07] text-center [&_.eyebrow]:text-[8px] [&_h1]:text-[36px] [&_h1]:tracking-[-.05em] [&_h1]:font-[550] [&_h1]:leading-[1.2] [&_h1]:mt-[17px] [&_h1_>_span]:text-[#8f82c4] [&_.workspace-error]:mt-4 [&_.workspace-error]:text-left max-[481px]:py-7.5 max-[481px]:px-[23px] max-[481px]:[&_h1]:text-[33px]">
                <span className="login-welcome-icon inline-flex items-center justify-center w-14 h-14 bg-[#f0edfc] text-[#8b7bce] rounded-[16px] mb-[25px]">
                    <BrandLogo decorative className="size-12" />
                </span>
                <p className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                    МЕНШЕ РУТИНИ. БІЛЬШЕ ЗРОБЛЕНОГО.
                </p>
                <h1>
                    Ваша робота.
                    <br />
                    <span>У вашому ритмі.</span>
                </h1>
                <p className="login-description text-subtle text-[12px] leading-[1.9] mt-4.5 mx-0 mb-7.5">
                    Проєкти, клієнти та фінанси.
                    <br />
                    Один простір, щоб тримати все під контролем.
                </p>
                <Button
                    onClick={signInWithGoogle}
                    disabled={isLoading}
                    variant="brand"
                    className="login-button w-full h-11.5 text-[12px] justify-between"
                >
                    <span
                        className="login-google inline-flex items-center justify-center w-[23px] h-[23px] bg-[white] rounded-[6px] text-[#6155db] text-[14px] font-[650]"
                        aria-hidden="true"
                    >
                        G
                    </span>
                    {isLoading ? 'Відкриваємо Google…' : 'Продовжити з Google'}
                    <ArrowRight size={17} />
                </Button>
                {!configured && (
                    <p className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0]">
                        Вхід ще налаштовується. Спробуйте трохи пізніше.
                    </p>
                )}
                {error && (
                    <p
                        role="alert"
                        className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0]"
                    >
                        {error}
                    </p>
                )}
                <div className="login-privacy border-t border-[#f0eef5] mt-6.5 pt-5.5 text-[#9793a6] text-[10px] flex items-center justify-center gap-1.5">
                    <ShieldCheck size={15} />
                    Ваші проєкти доступні лише вам
                </div>
            </section>
            <p className="login-footer text-[#9692a5] text-[10px] mt-[27px] text-center">
                Зосередьтеся на роботі. Решту впорядкуємо.
            </p>
        </main>
    );
}
