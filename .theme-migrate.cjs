const fs=require('fs'),path=require('path');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
let layout=fs.readFileSync('src/app/layout.tsx','utf8').replace("import { ThemeProvider, themeScript } from '@/components/theme-provider';","import { ThemeProvider } from '@/components/theme-provider';\nimport { themeScript } from '@/lib/theme';");fs.writeFileSync('src/app/layout.tsx',layout);
let theme=fs.readFileSync('src/components/theme-provider.tsx','utf8');const line=theme.match(/export const themeScript = .*?;\n/)[0];fs.writeFileSync('src/lib/theme.ts',line);theme=theme.replace(line,'');fs.writeFileSync('src/components/theme-provider.tsx',theme);
let login=fs.readFileSync('src/components/login-screen.tsx','utf8').replace('        </main>','            <div className="mt-8"><ThemePicker /></div>\n        </main>');fs.writeFileSync('src/components/login-screen.tsx',login);
const tokens=new Map();
for(const file of [...walk('src/components'),...walk('src/app')].filter(f=>f.endsWith('.tsx'))){let s=fs.readFileSync(file,'utf8');s=s.replace(/bg-white\b/g,'bg-card').replace(/text-\[#(?:fff|ffffff)\]/g,'text-white');
s=s.replace(/(bg|text|border|outline|ring|accent|fill|stroke)-\[(#[a-fA-F0-9]{3,8})\]/g,(all,type,hex)=>{
 if(![4,7].includes(hex.length))return all;
 const h=hex.length===4?'#'+[...hex.slice(1)].map(x=>x+x).join(''):hex.toLowerCase();const rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const lum=rgb.reduce((a,b)=>a+b,0)/765;const sat=(Math.max(...rgb)-Math.min(...rgb))/255;
 let dark;
 if(type==='text')dark=lum>.9?'#ffffff':sat>.25?'#b9aaff':'#b5bbce';
 else if(type==='border'||type==='outline'||type==='ring')dark='#3b4055';
 else if(type==='bg'&&lum>.65)dark=lum>.95?'#1c2030':'#292e42';
 else return all;
 const name='tone-'+type+'-'+h.slice(1);tokens.set(name,{light:h,dark});return type+'-[var(--'+name+')]';
});
s=s.replaceAll('text-brand','text-brand').replaceAll('bg-brand','bg-[var(--brand-solid)]');
// Tailwind status colors need matching surfaces and foreground contrast.
s=s.replace(/\b(bg|text)-(red|amber|emerald|green|slate)-(50|100|600|700|800|900)\b/g,(all,type,color,shade)=> all+' dark:'+type+'-'+color+'-'+(type==='bg'?'950':'300'));
if(s!==fs.readFileSync(file,'utf8'))fs.writeFileSync(file,s);
}
let css=fs.readFileSync('src/app/globals.css','utf8');css+= '\n/* Shared colors for existing Tailwind arbitrary utilities. */\n:root {\n --brand-solid: #6155db;\n'+[...tokens].map(([n,c])=>' --'+n+': '+c.light+';').join('\n')+'\n}\n.dark {\n --ink: #eef0fa;\n --subtle: #acb3c9;\n --line: #34394d;\n --brand: #b1a4ff;\n --background: #111522;\n --card: #1c2030;\n'+[...tokens].map(([n,c])=>' --'+n+': '+c.dark+';').join('\n')+'\n}\n';
css+='\n@layer base { .dark .login-page { background: radial-gradient(ellipse at 50% 35%, #27213d, #111522 65%); } }\n';fs.writeFileSync('src/app/globals.css',css);
