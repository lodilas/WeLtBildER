const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
  await page.setContent(html);
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'markdown-view.js'),'utf8').replaceAll('export function','function')});
  const text=fs.readFileSync(path.join(root,'../Lehrplantest/files/16478/Ges Geo Soz RP 7-10 2022.mistral.raw.md'),'utf8');
  console.log(await page.evaluate(async text=>{
   document.querySelectorAll('.hidden').forEach(e=>{if(!e.classList.contains('choice-picker-menu')) e.classList.remove('hidden')});
   const pane=document.querySelector('#sections-panel');document.body.replaceChildren(pane);
   pane.style.height='900px';
   const el=document.querySelector('#section-text');el.innerHTML='';
   const span=document.createElement('span');span.className='text-section pending-section';span.textContent=text;el.append(span);formatMarkdown(el);
   const picker=document.querySelector('#section-subjects');
   picker.innerHTML='<button type="button">auswählen</button><div class="choice-picker-menu hidden">'+Array.from({length:100},(_,i)=>'<label class="choice-option"><input type="checkbox">Fach '+i+'</label>').join('')+'</div>';
   const button=picker.querySelector('button'),menu=picker.querySelector('.choice-picker-menu');
   button.onclick=()=>menu.classList.toggle('hidden');
   const samples=[];
   for(let i=0;i<4;i++) {const t=performance.now();button.focus();button.click();menu.getBoundingClientRect();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));samples.push(performance.now()-t);}
   return {nodes:el.querySelectorAll('*').length,samples,focused:document.activeElement===button,sourceUnchanged:el.textContent===text};
  },text));
  if(errors.length) throw Error(errors.join('\n'));
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
