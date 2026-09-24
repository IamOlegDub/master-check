const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8').replaceAll("'@/lib/price-list'", JSON.stringify(path.resolve('src/lib/price-list.ts')));
    module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }, fileName: filename }).outputText, filename);
};
const { ProjectPaymentStatus } = require('../src/components/project-payment-status.tsx');
const render = (confirmed, paid) => renderToStaticMarkup(React.createElement(ProjectPaymentStatus, { confirmed, paid }));
test('payment cards distinguish debt, partial payment, settlement, advance and no confirmed work', () => {
    assert.match(render(500, 0), /Очікує оплати/);
    const partial = render(500, 200);
    assert.match(partial, /Оплачено частково/);
    assert.match(partial, /max="500" value="200"/);
    assert.match(partial, /300,00/);
    assert.match(render(500, 500), /Підтверджені роботи оплачені/);
    assert.match(render(500, 700), /Аванс на наступні роботи: 200,00/);
    assert.doesNotMatch(render(0, 200), /<progress/);
    assert.match(render(0, 0), /Ще немає підтверджених робіт/);
});
