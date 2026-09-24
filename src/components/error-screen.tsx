'use client';
import { CloudOff, RotateCw } from 'lucide-react';
export function ErrorScreen({ reset, compact = false }: { reset: () => void; compact?: boolean }) {
    return (
        <div
            className={`grid place-items-center bg-[#f7f8fb] p-6 text-ink ${compact ? 'min-h-96' : 'min-h-dvh'}`}
        >
            <section className="w-full max-w-lg rounded-3xl border border-line bg-white p-8 shadow-sm sm:p-12">
                <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                    <CloudOff size={30} />
                </div>
                <p className="text-xs font-semibold tracking-widest text-subtle">
                    НЕ ВДАЛОСЯ ЗАВАНТАЖИТИ
                </p>
                <h1 className="mt-3 text-3xl font-semibold">Спробуймо ще раз</h1>
                <p className="mt-4 leading-7 text-subtle">
                    Не вдалося отримати дані. Перевірте інтернет і повторіть спробу. Якщо перед цим
                    ви щось зберігали, перевірте результат після оновлення, щоб не створити
                    дублікат.
                </p>
                <button
                    className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand p-3 text-white"
                    onClick={reset}
                >
                    <RotateCw size={18} />
                    Спробувати знову
                </button>
                <a href="/" className="mt-4 block text-center text-sm text-subtle underline">
                    До робочого простору
                </a>
            </section>
        </div>
    );
}
