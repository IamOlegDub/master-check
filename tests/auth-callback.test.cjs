const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function compile(file, dependencies) {
    const module = {exports:{}};
    new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>dependencies[name]??require(name),module,module.exports);
    return module.exports;
}
const auth = compile('src/lib/auth-redirect.ts',{});
const {GET} = compile('src/app/auth/callback/route.ts',{
    '@supabase/ssr':{createServerClient:()=>({auth:{exchangeCodeForSession:async()=>({error:null})}})},
    '@/lib/supabase/env':{getSupabaseEnv:()=>({url:'https://example.invalid',key:'test'})},
    '@/lib/auth-redirect':auth,
});
test('OAuth callback preserves localhost, loopback and deployed origins and safely restores intended page',async()=>{
    for(const origin of ['http://localhost:3000','http://127.0.0.1:3000','https://mastercheck.example']) {
        const response=await GET(new Request(origin+'/auth/callback?code=test',{headers:{cookie:'mc-auth-next='+encodeURIComponent('/projects?view=active')}}));
        assert.equal(response.headers.get('location'),origin+'/projects?view=active');
        assert.match(response.headers.get('set-cookie'),/mc-auth-next=;.*Max-Age=0/i);
    }
    for(const destination of ['https://evil.example','//evil.example','/\\evil.example']) {
        const response=await GET(new Request('http://localhost:3000/auth/callback?code=test',{headers:{cookie:'mc-auth-next='+encodeURIComponent(destination)}}));
        assert.equal(response.headers.get('location'),'http://localhost:3000/');
    }
});
