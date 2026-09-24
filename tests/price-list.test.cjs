const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        fileName: filename,
    });
    module._compile(compiled.outputText, filename);
};
const { validateService, selectServices, serviceUnits, formatPrice } = require('../src/lib/price-list.ts');
const { buildPriceListPdf } = require('../src/lib/price-list-pdf.ts');
const categories = [{ id: 'tile', name: '\u041f\u043b\u0438\u0442\u043a\u0430' }, { id: 'wood', name: '\u0414\u0435\u0440\u0435\u0432\u043e' }];
const services = [
    { id: '1', category_id: 'tile', name: 'Tile work', price: 650.25, unit: 'm2' },
    { id: '2', category_id: 'wood', name: 'Wood work', price: 1200, unit: 'lm' },
    { id: '3', category_id: 'tile', name: 'Tile preparation', price: 0, unit: 'hour' },
];

test('category and search filters combine; numeric prices sort without mutating source', () => {
    assert.deepEqual(selectServices(services, categories, 'tile', ' TILE ', 'price-desc').map(s => s.id), ['1', '3']);
    assert.deepEqual(selectServices(services, categories, '', categories[1].name.toUpperCase(), 'name').map(s => s.id), ['2']);
    assert.deepEqual(selectServices(services, categories, '', '', 'price-asc').map(s => s.id), ['3', '1', '2']);
    assert.deepEqual(services.map(s => s.id), ['1', '2', '3']);
});

test('all service columns support both sort directions', () => {
    const ids = sort => selectServices(services, categories, '', '', sort).map(s => s.id);
    assert.deepEqual(ids('name'), ['3', '1', '2']);
    assert.deepEqual(ids('name-desc'), ['2', '1', '3']);
    assert.deepEqual(ids('category'), ['2', '3', '1']);
    assert.deepEqual(ids('category-desc'), ['3', '1', '2']);
    assert.deepEqual(ids('unit'), ['3', '1', '2']);
    assert.deepEqual(ids('unit-desc'), ['2', '1', '3']);
    assert.deepEqual(ids('price-desc'), ['2', '1', '3']);
});

test('valid prices include zero; invalid precision, missing category and unsupported units are rejected', () => {
    for (const unit of Object.keys(serviceUnits)) assert.equal(validateService('Service', '0', unit, 'tile'), null);
    assert.equal(validateService('Service', '9999999999.99', 'm2', 'tile'), null);
    for (const price of ['', '-1', '1.234', 'Infinity', 'NaN', '10000000000', '1e2']) assert.ok(validateService('Service', price, 'm2', 'tile'));
    assert.ok(validateService('   ', '5', 'm2', 'tile'));
    assert.ok(validateService('Service', '5', 'invalid', 'tile'));
    assert.ok(validateService('Service', '5', 'toString', 'tile'));
    assert.ok(validateService('Service', '5', 'm2', ''));
    assert.equal(formatPrice(1234.5), '1\u00a0234,50\u00a0\u20b4');
});

test('PDF embeds Cyrillic glyphs, wraps long names, paginates and includes only requested rows', () => {
    const font = fs.readFileSync('public/fonts/NotoSans-Regular.ttf').toString('base64');
    const longName = '\u0423\u043a\u043b\u0430\u0434\u0430\u043d\u043d\u044f \u043f\u043b\u0438\u0442\u043a\u0438 ';
    const rows = Array.from({length: 100}, (_, i) => ({...services[i % 3], id: String(i), name: longName.repeat(7).slice(0, 150) + i}));
    const doc = buildPriceListPdf({services: rows, categories, author: longName.repeat(8), contact: 'contact@example.com'}, font, new Date(2026, 8, 20));
    assert.ok(doc.getNumberOfPages() > 2);
    const pdf = Buffer.from(doc.output('arraybuffer'));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.includes(Buffer.from('/FontFile2')));
    const metadata = doc.getFont().metadata;
    for (const code of [0x423, 0x456, 0x457, 0x454, 0x491, 0xb2]) assert.ok(metadata.characterToGlyph(code) > 0, `Missing glyph ${code}`);
    const single = buildPriceListPdf({services: [services[0]], categories, author: 'Master', contact: ''}, font);
    assert.equal(single.lastAutoTable.body.length, 1);
    assert.equal(single.lastAutoTable.body[0].raw[0], 'Tile work');
    assert.throws(() => buildPriceListPdf({services: [], categories, author: '', contact: ''}, font));
    if (process.env.PRICE_LIST_REVIEW_PDF) fs.writeFileSync(process.env.PRICE_LIST_REVIEW_PDF, pdf);
});
