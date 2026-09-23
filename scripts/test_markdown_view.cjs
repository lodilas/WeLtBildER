// Browser regression: rendering must preserve source offsets for annotations.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage();
    const code = fs.readFileSync(path.join(__dirname, '../markdown-view.js'), 'utf8').replaceAll('export function', 'function');
    await page.setContent('<article id="test"></article>');
    await page.addScriptTag({content:code});
    const root = path.resolve(__dirname, '../../Lehrplantest/files');
    for (const id of ['16118','16478','16508','18458','18459','18562','25803','41888','48690','48699']) {
      const file = fs.readdirSync(path.join(root,id)).find(f=>f.endsWith('.mistral.raw.md'));
      const source = fs.readFileSync(path.join(root,id,file),'utf8');
      const result = await page.evaluate(source => {
        const el = document.querySelector('#test'); el.textContent=source;
        formatMarkdown(el);
        if(el.textContent!==source) throw Error('Offset invariant');
        const needle='Deutschland'; const at=source.indexOf(needle);
        if(at>=0) {
          el.textContent=source.slice(0,at);
          const mark=document.createElement('mark'); mark.textContent=needle;
          el.append(mark,document.createTextNode(source.slice(at+needle.length)));
          formatMarkdown(el);
          const target=el.querySelector('mark');
          const range=document.createRange(); range.selectNodeContents(el); range.setEnd(target.firstChild,0);
          if(range.toString().length!==at) throw Error('Selection offset mismatch');
        }
        return {characters:source.length,cells:el.querySelectorAll('.md-cell').length};
      },source);
      console.log(id,JSON.stringify(result));
    }
    await page.evaluate(()=>{
      const el=document.querySelector('#test');
      const text='# Titel\n\n| **Frankreich** | Deutschland |\n| --- | --- |\n[Berlin](https://Paris.example)\n<script>bad()</script>';
      el.textContent=text; formatMarkdown(el);
      if(el.querySelector('script')) throw Error('Unsafe HTML');
      if(el.textContent!==text) throw Error('Source changed');
      if(markdownNerText(text).includes('Paris')) throw Error('Link target not masked');
      if(markdownNerText(text).length!==text.length) throw Error('Mask offset mismatch');
    });
    console.log('PASS: 10 documents, selection offsets, annotations, inert HTML, URL masking');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
