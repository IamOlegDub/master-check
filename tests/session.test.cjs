const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest } = require('next/server');
function compile(file, dependencies) {
    const module = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(name => dependencies[name] ?? require(name), module, module.exports);
    return module.exports;
}
const redirects = compile('src/lib/auth-redirect.ts', {});
function proxyFor(result) {
    return compile('src/proxy.ts', {
        '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
            options.cookies.setAll([{ name: 'first-refresh', value: 'first', options: { path: '/' } }]);
            options.cookies.setAll([{ name: 'second-refresh', value: 'second', options: { path: '/' } }]);
            return result;
        } } }) },
        '@/lib/supabase/env': { getSupabaseEnv: () => ({ url: 'https://example.invalid', key: 'test' }) },
        '@/lib/auth-redirect': redirects,
    }).proxy;
}
test('temporary auth outages retain cookies and do not redirect the user to OAuth', async () => {
    for (const error of [{ name: 'AuthRetryableFetchError', status: 0 }, { status: 503 }, { status: 429 }]) {
        const response = await proxyFor({ data: { user: null }, error })(new NextRequest('https://example.com/projects'));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('location'), null);
        assert.equal(response.cookies.get('first-refresh').value, 'first');
        assert.equal(response.cookies.get('second-refresh').value, 'second');
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
});
test('valid refresh persists every cookie; genuinely missing sessions still require login', async () => {
    const response = await proxyFor({ data: { user: { id: 'user' } }, error: null })(new NextRequest('https://example.com/projects'));
    assert.equal(response.status, 200);
    assert.equal(response.cookies.get('first-refresh').value, 'first');
    assert.equal(response.cookies.get('second-refresh').value, 'second');
    const missing = await proxyFor({ data: { user: null }, error: { status: 400, name: 'AuthSessionMissingError' } })(new NextRequest('https://example.com/projects'));
    assert.equal(missing.status, 307);
    assert.equal(new URL(missing.headers.get('location')).pathname, '/login');
    assert.equal(new URL(missing.headers.get('location')).searchParams.get('next'), '/projects');
});