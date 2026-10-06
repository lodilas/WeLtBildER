const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {chromium} = require('playwright');
(async () => {
  const root = path.resolve(__dirname,'..');
  const old = cp.execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,'show','HEAD:markdown-view.js'],{encoding:'utf8'});
  const current = fs.readFileSync(path.join(root,'markdown-view.js'),'utf8');
  const app = fs.readFileSync(path.join(root,'app.js'),'utf8');
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage();
    const source=('# Titel\n\n| **Frankreich** | Deutschland |\n| --- | --- |\n| Europa | Asien |\nText über Geographie.\n\n').repeat(400);
    for(const [name,code] of [['before',old],['after',current]]) {
      await page.setContent('<article id="test"></article>');
      await page.addScriptTag({content:code.replaceAll('export function','function')});
      const results=await page.evaluate(({source})=>{
        const el=document.querySelector('#test'); const times=[];
        for(let run=0;run<3;run++) {
          el.replaceChildren();
          // Thousands of annotation boundaries, as after repeated review.
          for(let i=0;i<source.length;i+=20) {
            const span=document.createElement('span');span.className='text-section';
            span.dataset.id=String(i);span.textContent=source.slice(i,i+20);el.append(span);
          }
          const start=performance.now();formatMarkdown(el);times.push(performance.now()-start);
          if(el.textContent!==source) throw Error('Offsets changed');
          if([...el.querySelectorAll('.text-section')].map(n=>n.textContent).join('')!==source) throw Error('Annotations lost');
        }
        return times;
      },{source});
      console.log(name,JSON.stringify(results));
    }
    // Execute the actual section-render function with a minimal state fixture.
    const start=app.indexOf('let sectionRenderCache = null;');
    const end=app.indexOf('function scrollToSectionEnd',start);
    await page.addScriptTag({content:`
      const state={text:'# Heading\\nText',textFormat:'markdown',sections:[{id:1,char_start:2,char_end:9,section_title:'Heading'}],pendingSectionSelection:null,selectedSectionId:1};
      const elements={sectionText:document.querySelector('#test'),sectionsSummary:document.createElement('div')};
      function escapeHtml(s){return s.replaceAll('&','&amp;').replaceAll('<','&lt;');}
      function renderSearchControls(){} function selectSection(){}
      ${app.slice(start,end)}
      renderSectionText();
      const first=elements.sectionText.firstChild;
      state.selectedSectionId=null;renderSectionText();
      if(first!==elements.sectionText.firstChild) throw Error('Selection rebuilt DOM');
      if(elements.sectionText.querySelector('.selected')) throw Error('Selection colour stale');
      state.sections[0].grade_levels='5';renderSectionText();
      if(first!==elements.sectionText.firstChild) throw Error('Metadata rebuilt DOM');
      state.sections[0].char_end=12;renderSectionText();
      if(first===elements.sectionText.firstChild) throw Error('Changed range was not rendered');
      state.sections=[{id:1,char_start:2,char_end:9,section_title:'A'}, {id:2,char_start:5,char_end:12,section_title:'B'}];
      renderSectionText();
      if(elements.sectionText.textContent!==state.text) throw Error('Overlapping sections changed text');
      const overlap=[...elements.sectionText.querySelectorAll('.text-section')].filter(n=>n.title==='A · B');
      if(overlap.map(n=>n.textContent).join('')!==state.text.slice(5,9)) throw Error('Overlapping section coverage changed');
      // Current Edge/Chrome/Safari use a browser highlight for a pending range,
      // while browsers without the API retain the HTML span fallback.
      state.text='# Heading\\nText'; state.sections=[]; state.pendingSectionSelection={char_start:2,char_end:9,surface:'Heading'};
      sectionRenderCache=null; renderSectionText();
      if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function') {
        if (!CSS.highlights.has('lehrplan-pending-section')) throw Error('Native pending highlight absent');
        if (elements.sectionText.querySelector('.pending-section')) throw Error('Native highlight unnecessarily rebuilt Markdown');
      }
      supportsPendingSectionHighlight=()=>false; sectionRenderCache=null; renderSectionText();
      if (!elements.sectionText.querySelector('.pending-section')) throw Error('Fallback pending highlight absent');
    `});
    console.log('PASS: offsets, annotations, selection cache, metadata cache, range invalidation');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
