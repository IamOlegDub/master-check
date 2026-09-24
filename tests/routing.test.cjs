const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) =>
    module._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        }).outputText,
        filename,
    );
const { projectSlug, projectHref } = require('../src/lib/project-url.ts');
const { safeReturnPath } = require('../src/lib/auth-redirect.ts');
const { displayDate } = require('../src/lib/estimates.ts');
test('readable project URLs normalize Ukrainian names and preserve owner namespace', () => {
    assert.equal(projectSlug('вул. Мазепи, 21'), 'vul-mazepy-21');
    assert.equal(projectSlug('Київ — Їжак та Єнот'), 'kyiv-yizhak-ta-yenot');
    assert.equal(projectSlug('  КУХНЯ / 12? #  '), 'kukhnia-12');
    assert.equal(projectSlug('🏠Єнот'), 'yenot');
    assert.equal(projectSlug('🏠'), '');
    assert.equal(
        projectHref({ id: 'id', owner_username: 'ivan', slug: 'vul-mazepy-21' }),
        '/ivan/vul-mazepy-21',
    );
    assert.notEqual(
        projectHref({ id: 'id', owner_username: 'ivan', slug: 'house' }),
        projectHref({ id: 'id2', owner_username: 'oleg', slug: 'house' }),
    );
});
test('authentication returns only to local paths, preserving invitations', () => {
    assert.equal(safeReturnPath('/invite/token?test=1'), '/invite/token?test=1');
    for (const input of [
        'https://evil.test',
        '//evil.test',
        '/\\evil.test',
        '/\nevil.test',
        '/\revil.test',
    ])
        assert.equal(safeReturnPath(input), '/');
});
test('SSR dates do not depend on the server or browser default time zone', () => {
    const before = process.env.TZ;
    try {
        process.env.TZ = 'UTC';
        const server = displayDate('2026-07-01T12:00:00Z');
        process.env.TZ = 'America/New_York';
        assert.equal(displayDate('2026-07-01T12:00:00Z'), server);
        assert.equal(server, '01.07.2026 15:00 (Київ)');
    } finally {
        if (before === undefined) delete process.env.TZ;
        else process.env.TZ = before;
    }
});
