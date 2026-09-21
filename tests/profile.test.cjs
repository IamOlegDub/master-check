const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename }).outputText, filename);
const { profileFromUser, initials, validateProfile, safeAvatarUrl } = require('../src/lib/profile.ts');

test('Google fallback and custom profile survive provider metadata updates, including photo removal', () => {
    const user = { email: 'ivan@example.com', user_metadata: { full_name: 'Іван Сидоренко', avatar_url: 'https://example.com/google.jpg' } };
    const profile = profileFromUser(user);
    assert.equal(profile.firstName, 'Іван');
    assert.equal(profile.lastName, 'Сидоренко');
    assert.equal(initials('Іван Сидоренко'), 'ІС');
    assert.equal(initials('Іван'), 'І');
    assert.equal(initials('  Іван   Сидоренко Петренко '), 'ІС');
    user.user_metadata.mastercheck_profile = { ...profile, firstName: 'Олег', avatarUrl: '', lastName: '' };
    user.user_metadata.full_name = 'Changed Google Name';
    const saved = profileFromUser(user);
    assert.equal(saved.firstName, 'Олег');
    assert.equal(saved.lastName, '');
    assert.equal(saved.avatarUrl, '');
    assert.equal(saved.email, user.email);
});
test('required fields, optional phone and safe avatar sources', () => {
    const profile = profileFromUser({ email: 'test@example.com', user_metadata: { name: 'Test' } });
    assert.equal(validateProfile(profile), null);
    assert.ok(validateProfile({ ...profile, firstName: ' ' }));
    assert.ok(validateProfile({ ...profile, email: '' }));
    assert.ok(validateProfile({ ...profile, email: 'invalid' }));
    assert.ok(validateProfile({ ...profile, phone: '123' }));
    assert.equal(validateProfile({ ...profile, phone: '+380 (67) 123-45-67' }), null);
    assert.ok(validateProfile({ ...profile, bio: 'x'.repeat(601) }));
    assert.equal(safeAvatarUrl('javascript:alert(1)'), '');
    assert.equal(safeAvatarUrl('data:image/svg+xml,test'), '');
    assert.equal(safeAvatarUrl('https://example.com/avatar.jpg'), 'https://example.com/avatar.jpg');
    assert.equal(profileFromUser({ email: 'old@example.com', new_email: 'new@example.com', user_metadata: {} }).pendingEmail, 'new@example.com');
});
