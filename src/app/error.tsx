'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
    return (
        <main className="mx-auto max-w-xl p-8">
            <h1 className="text-2xl font-semibold">Не вдалося відкрити робочий простір</h1>
            <p className="my-4">
                Перевірте з’єднання. Якщо застосунок щойно оновлено, виконайте нові SQL-міграції в
                Supabase за інструкцією адміністратора.
            </p>
            <button className="rounded-xl bg-brand p-3 text-white" onClick={reset}>
                Спробувати знову
            </button>
            <a className="ml-4 underline" href="/login">
                До входу
            </a>
        </main>
    );
}
