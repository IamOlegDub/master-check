const fs=require('fs');for(const p of ['src/components/profile-styles.ts','src/lib/workspace.ts']){fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('bg-white','bg-card').replaceAll('bg-brand','bg-[var(--brand-solid)]'))}
let p='src/components/login-screen.tsx';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('bg-[#ffffffed]','bg-card/95').replace('login-page text-ink','login-page text-ink dark:[background:radial-gradient(ellipse_at_50%_35%,_#27213d,_#111522_65%)]'));
p='src/components/photo-gallery.tsx';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('text-black','text-ink'));
p='src/components/theme-provider.tsx';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('has-checked:border-brand','focus-within:outline-2 focus-within:outline-brand has-checked:border-brand'));
