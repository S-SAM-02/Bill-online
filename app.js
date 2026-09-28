const $ = id => document.getElementById(id);

const fields = ['invoiceNo','invoiceDate','dueDate','clientName','clientUpi','project','service','paymentMethod','projectTotal','currentPayment','previousReceived','utr','transactionId','paymentDateTime','receivedIn','payerUpi','debitedFrom','recipient','recipientUpi','notes'];

const HISTORY_KEY = 'samBillHistory';
const DRAFT_KEY = 'samBillDraft';
const SAVED_KEY = 'samBillSaved';
const SEQ_KEY = 'samInvoiceSeq';

function today(){ return new Date().toISOString().slice(0,10); }
function nextInvoice(){
  const n = Number(localStorage.getItem(SEQ_KEY) || 20);
  return `SAM-INV-${new Date().getFullYear()}-${String(n).padStart(3,'0')}`;
}
function money(v){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(v)||0);
}
function words(n){
  n=Math.round(Number(n)||0);
  if(!n) return '₹0 (Zero Only)';
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const two=x=>x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:'');
  const part=x=>{let s='';if(x>=100)s+=ones[Math.floor(x/100)]+' Hundred ';x%=100;if(x)s+=two(x);return s.trim();};
  const original=n; let s='';
  if(n>=10000000){s+=part(Math.floor(n/10000000))+' Crore ';n%=10000000;}
  if(n>=100000){s+=part(Math.floor(n/100000))+' Lakh ';n%=100000;}
  if(n>=1000){s+=part(Math.floor(n/1000))+' Thousand ';n%=1000;}
  if(n)s+=part(n);
  return `₹${new Intl.NumberFormat('en-IN').format(original)} (Rupees ${s.trim()} Only)`;
}
function fmtDate(v){
  if(!v)return '';
  const d=new Date(v+'T00:00:00');
  return isNaN(d)?v:d.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
}
function fmtDateTime(v){
  if(!v)return '';
  const d=new Date(v);
  if(isNaN(d))return v;
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})+' • '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}
function status(total,received){
  if(!total)return 'Enter Total';
  if(received<=0)return 'Pending';
  if(received>=total)return 'Cleared';
  return 'Partially Paid';
}
function getData(){
  const d={}; fields.forEach(f=>d[f]=$(f).value); return d;
}
function setData(d){
  fields.forEach(f=>{if(d[f]!==undefined)$(f).value=d[f];});
  render();
}
function totals(d=getData()){
  const total=Number(d.projectTotal)||0, current=Number(d.currentPayment)||0, previous=Number(d.previousReceived)||0;
  const received=current+previous, pending=Math.max(total-received,0);
  return {total,current,previous,received,pending,status:status(total,received)};
}
function render(){
  const d=getData(), t=totals(d);
  document.querySelectorAll('[data-out]').forEach(el=>{
    const k=el.dataset.out; let v=d[k]||'';
    if(k==='invoiceDate'||k==='dueDate')v=fmtDate(v);
    if(k==='paymentDateTime')v=fmtDateTime(v);
    if(k==='currentPayment')v=money(t.current);
    if(k==='totalReceived')v=money(t.received);
    if(k==='pending')v=money(t.pending);
    if(k==='projectTotal')v=money(t.total);
    if(k==='currentPaymentWords')v=words(t.current);
    if(k==='status')v=t.status;
    if(k==='statusLower')v=t.status.toLowerCase();
    el.textContent=v;
  });
  $('notesOut').textContent=d.notes||'';
  $('currentDisplay').textContent=money(t.current);
  $('receivedDisplay').textContent=money(t.received);
  $('pendingDisplay').textContent=money(t.pending);
  $('statusDisplay').textContent=t.status;
  const valid=t.total>0 && t.received<=t.total && d.clientName.trim() && d.project.trim() && d.service.trim();
  $('verificationBadge').textContent=t.total && t.received>t.total?'Check: received exceeds project total':!t.total?'Enter full project amount to verify balance':valid?'Ready for verification':'Complete required fields';
  $('verificationBadge').className='verification '+(valid?'ok':'');
  localStorage.setItem(DRAFT_KEY,JSON.stringify(d));
  $('saveStatus').textContent='Draft auto-saved';
  renderHistory();
}
function toast(t){
  const e=$('toast'); e.textContent=t; e.classList.add('show');
  setTimeout(()=>e.classList.remove('show'),2400);
}
function validateBill(){
  const d=getData(), t=totals(d);
  const required=[['invoiceNo','Invoice number'],['clientName','Client name'],['project','Website / project'],['service','Service / description']];
  const missing=required.find(([id])=>!$(id).value.trim());
  if(missing){ toast(missing[1]+' is required'); $(missing[0]).focus(); return false; }
  if(t.total<=0){toast('Enter the full project amount');$('projectTotal').focus();return false;}
  if(t.current<0||t.previous<0){toast('Payment amounts cannot be negative');return false;}
  if(t.received>t.total){toast('Total cleared cannot be greater than the full project amount');return false;}
  return true;
}
function saveData(){
  if(!validateBill())return;
  const d=getData(), t=totals(d);
  localStorage.setItem(SAVED_KEY,JSON.stringify(d));
  let history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  const record={...d,savedAt:new Date().toISOString(),totalCleared:t.received,pending:t.pending,paymentStatus:t.status};
  const idx=history.findIndex(x=>x.invoiceNo===d.invoiceNo);
  if(idx>=0)history[idx]=record; else history.unshift(record);
  history=history.slice(0,100);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  renderHistory(); toast('Bill saved to the local dataset');
}
function blankBill(){
  const d={};
  fields.forEach(f=>d[f]='');
  return d;
}
function clearNew(){
  localStorage.removeItem(SAVED_KEY);
  localStorage.removeItem(DRAFT_KEY);
  setData(blankBill());
  localStorage.removeItem(DRAFT_KEY);
  $('invoiceNo').focus();
  toast('New bill cleared — enter every detail manually or upload payment files');
}

function loadSaved(index){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(history[index]){setData(history[index]);toast('Saved bill loaded');}
}
function deleteSaved(index){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  const bill=history[index];
  if(!bill)return;
  if(!confirm(`Delete saved bill ${bill.invoiceNo} from this browser?`))return;
  history.splice(index,1); localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  renderHistory(); toast('Saved bill deleted');
}
function exportDataset(){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(!history.length){toast('No saved bills to export');return;}
  const blob=new Blob([JSON.stringify(history,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='SAM-Company-Bills-Dataset.json'; a.click();
  URL.revokeObjectURL(a.href); toast('Dataset exported');
}
function renderHistory(){
  const panel=$('historyPanel'); if(!panel)return;
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  const list=$('historyList');
  list.innerHTML='';
  $('historyCount').textContent=history.length;
  if(!history.length){list.innerHTML='<div class="history-empty">No saved bills yet. Use <b>Save Data</b> after completing a bill.</div>';return;}
  history.forEach((b,i)=>{
    const row=document.createElement('div'); row.className='history-row';
    row.innerHTML=`<div><b>${escapeHtml(b.invoiceNo||'No invoice')}</b><span>${escapeHtml(b.clientName||'')} · ${escapeHtml(b.project||'')}</span></div><div class="history-money"><b>${money(b.totalCleared||0)}</b><span>Pending ${money(b.pending||0)}</span></div><div class="history-actions"><button class="btn mini secondary" data-load="${i}">Load</button><button class="btn mini danger" data-delete="${i}">Delete</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>loadSaved(Number(b.dataset.load)));
  list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteSaved(Number(b.dataset.delete)));
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function installHistoryPanel(){
  if($('historyPanel'))return;
  const panel=document.createElement('section'); panel.id='historyPanel'; panel.className='history-panel no-print';
  panel.innerHTML='<div class="history-head"><div><b>Saved Bills Dataset</b><span><strong id="historyCount">0</strong> saved</span></div><button id="exportDataset" class="btn mini secondary">Export Dataset</button></div><div id="historyList"></div>';
  document.querySelector('.control-panel').appendChild(panel);
  $('exportDataset').onclick=exportDataset;
  renderHistory();
}
async function pdf(){
  if(!validateBill())return;
  render();
  if(typeof html2pdf==='undefined'){toast('PDF library not loaded — use Print PDF');return;}
  const el=$('invoicePreview');
  const opt={margin:0,filename:($('invoiceNo').value||'SAM-Invoice')+'.pdf',image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}};
  try{await html2pdf().set(opt).from(el).save();toast('PDF saved successfully');}catch(e){console.error(e);toast('PDF failed — use Print PDF');}
}
function cleanOCRText(text){
  return String(text||'')
    .replace(/\r/g,'')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/\u00a0/g,' ')
    .replace(/[ \t]+/g,' ')
    .trim();
}
function normalizeAmount(value){
  const n=String(value||'').replace(/[₹Rs.INR\s,]/gi,'').replace(/[^0-9.]/g,'');
  const v=Number(n);
  return Number.isFinite(v) ? v : 0;
}
function valueAfterLabel(lines, patterns){
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    for(const re of patterns){
      const m=line.match(re);
      if(m && m[1] && m[1].trim()) return m[1].trim();
      if(re.test(line) && lines[i+1] && lines[i+1].trim()) return lines[i+1].trim();
    }
  }
  return '';
}
function parseOCR(text){
  const raw=cleanOCRText(text);
  const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);

  // Only fill a field when the OCR text contains a recognizable label.
  // This prevents unrelated text from being guessed into bill fields.
  const amountText=valueAfterLabel(lines,[
    /(?:amount|payment|transaction)\s*(?:received|paid|sent|amount)?\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:total\s*amount|paid\s*amount)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
  ]);
  const utr=valueAfterLabel(lines,[
    /(?:upi\s*reference|upi\s*ref(?:erence)?|utr|rrn|reference\s*(?:no|number))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{5,})/i
  ]);
  const txn=valueAfterLabel(lines,[
    /(?:phonepe\s*)?(?:transaction\s*(?:id|number)|txn\s*(?:id|no|number))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{8,})/i
  ]);
  const payerUpi=valueAfterLabel(lines,[
    /(?:payer|sender)\s*(?:upi\s*)?(?:id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,})/i,
    /(?:from|debited\s*from)\s*(?:upi\s*)?(?:id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,})/i
  ]);
  const recipientUpi=valueAfterLabel(lines,[
    /(?:recipient|receiver|paid\s*to|credited\s*to)\s*(?:upi\s*)?(?:id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,})/i
  ]);
  const client=valueAfterLabel(lines,[
    /(?:payment\s*received\s*from|payer\s*name|sender\s*name|client\s*name)\s*[:#\-]?\s*(.+)$/i
  ]);
  const paidTo=valueAfterLabel(lines,[
    /(?:recipient\s*name|receiver\s*name|recipient|paid\s*to|credited\s*to)\s*[:#\-]?\s*(.+)$/i
  ]);
  const receivedIn=valueAfterLabel(lines,[
    /(?:received\s*in|credited\s*in|bank\s*account|credited\s*to\s*bank\s*account)\s*[:#\-]?\s*(.+)$/i
  ]);
  const debitedFrom=valueAfterLabel(lines,[
    /(?:debited\s*from|debit(?:ed)?\s*account|paid\s*from)\s*[:#\-]?\s*(.+)$/i
  ]);
  const dateTime=valueAfterLabel(lines,[
    /(?:date\s*(?:&|and)?\s*time|payment\s*date|transaction\s*date|paid\s*on)\s*[:#\-]?\s*(.+)$/i
  ]);

  if(amountText) $('currentPayment').value=normalizeAmount(amountText);
  if(utr) $('utr').value=utr.trim();
  if(txn) $('transactionId').value=txn.trim();
  if(payerUpi) $('payerUpi').value=payerUpi.trim();
  if(recipientUpi) $('recipientUpi').value=recipientUpi.trim();
  if(client) $('clientName').value=client.trim();
  if(paidTo) $('recipient').value=paidTo.trim();
  if(receivedIn) $('receivedIn').value=receivedIn.trim();
  if(debitedFrom) $('debitedFrom').value=debitedFrom.trim();

  if(dateTime){
    const rawDate=dateTime.replace(/\bat\b/i,' ').replace(/\s+/g,' ').trim();
    let m=rawDate.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
    if(m){
      let y=Number(m[3]); if(y<100)y+=2000;
      let hh=Number(m[4]); const ap=(m[6]||'').toUpperCase();
      if(ap==='PM' && hh<12)hh+=12;
      if(ap==='AM' && hh===12)hh=0;
      $('paymentDateTime').value=`${y.toString().padStart(4,'0')}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${hh.toString().padStart(2,'0')}:${m[5]}`;
    }else{
      m=rawDate.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
      if(m){
        const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const mo=months.indexOf(m[2].slice(0,3).toLowerCase())+1;
        let hh=Number(m[4]); const ap=(m[6]||'').toUpperCase();
        if(ap==='PM' && hh<12)hh+=12;
        if(ap==='AM' && hh===12)hh=0;
        if(mo>0)$('paymentDateTime').value=`${m[3]}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}T${String(hh).padStart(2,'0')}:${m[5]}`;
      }
    }
  }

  render();
  return {
    amount:amountText ? normalizeAmount(amountText) : 0,
    utr,txn,payerUpi,recipientUpi,client,paidTo,receivedIn,debitedFrom,dateTime,
    matched:[amountText,utr,txn,payerUpi,recipientUpi,client,paidTo,receivedIn,debitedFrom,dateTime].filter(Boolean).length
  };
}

async function ocrImage(file, worker, progressLabel){
  const result=await worker.recognize(file);
  $('ocrStatus').textContent=progressLabel;
  return result.data.text || '';
}

async function ocrPdf(file, worker, progressLabel){
  if(typeof pdfjsLib==='undefined') throw new Error('PDF engine unavailable');
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const chunks=[];
  const maxPages=Math.min(pdf.numPages,20);
  for(let pageNo=1;pageNo<=maxPages;pageNo++){
    $('ocrStatus').textContent=`${progressLabel} — PDF page ${pageNo}/${maxPages}`;
    const page=await pdf.getPage(pageNo);
    const textContent=await page.getTextContent();
    const directText=textContent.items.map(item=>item.str||'').join(' ').trim();
    if(directText.length>=40){
      chunks.push(directText);
      continue;
    }
    const viewport=page.getViewport({scale:2});
    const canvas=document.createElement('canvas');
    canvas.width=Math.floor(viewport.width);
    canvas.height=Math.floor(viewport.height);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    await page.render({canvasContext:ctx,viewport}).promise;
    const result=await worker.recognize(canvas);
    chunks.push(result.data.text||'');
    canvas.width=1; canvas.height=1;
  }
  if(pdf.numPages>20) chunks.push(`[Only first 20 pages processed from ${file.name}]`);
  return chunks.join('\n');
}


async function fileToCompressedImage(file){
  if(file.type.startsWith('image/')){
    const src=await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
    });
    const img=await new Promise((resolve,reject)=>{
      const im=new Image(); im.onload=()=>resolve(im); im.onerror=reject; im.src=src;
    });
    const max=1800, scale=Math.min(1,max/img.width,max/img.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*scale));
    canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.8);
  }
  throw new Error('Unsupported image file');
}

async function pdfToAiImages(file){
  if(typeof pdfjsLib==='undefined') throw new Error('PDF engine unavailable');
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const images=[];
  const maxPages=Math.min(pdf.numPages,6);
  for(let pageNo=1;pageNo<=maxPages;pageNo++){
    $('ocrStatus').textContent='Preparing '+file.name+' — PDF page '+pageNo+'/'+maxPages+' for AI';
    const page=await pdf.getPage(pageNo);
    const viewport=page.getViewport({scale:1.5});
    const canvas=document.createElement('canvas');
    canvas.width=Math.floor(viewport.width);
    canvas.height=Math.floor(viewport.height);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    await page.render({canvasContext:ctx,viewport}).promise;
    images.push(canvas.toDataURL('image/jpeg',0.78));
    canvas.width=1; canvas.height=1;
  }
  return images;
}

function applyAiFields(result){
  const map={
    invoiceNo:'invoiceNo', invoiceDate:'invoiceDate', dueDate:'dueDate',
    clientName:'clientName', clientUpi:'clientUpi', project:'project',
    service:'service', paymentMethod:'paymentMethod', projectTotal:'projectTotal',
    currentPayment:'currentPayment', previousReceived:'previousReceived',
    utr:'utr', transactionId:'transactionId', paymentDateTime:'paymentDateTime',
    receivedIn:'receivedIn', payerUpi:'payerUpi', debitedFrom:'debitedFrom',
    recipient:'recipient', recipientUpi:'recipientUpi', notes:'notes'
  };
  let matched=0;
  Object.entries(map).forEach(([key,id])=>{
    const value=result?.[key];
    if(value!==undefined && value!==null && String(value).trim()!==''){
      if(['projectTotal','currentPayment','previousReceived'].includes(key)){
        const amount=normalizeAmount(value);
        if(amount>0){$(id).value=amount; matched++;}
      }else if(key==='paymentMethod'){
        const v=String(value).trim();
        const option=[...$('paymentMethod').options].find(o=>o.text.toLowerCase()===v.toLowerCase());
        $('paymentMethod').value=option?option.value:v;
        matched++;
      }else if(key==='invoiceDate'||key==='dueDate'){
        const v=String(value).trim();
        if(/^\d{4}-\d{2}-\d{2}$/.test(v)){$(id).value=v;matched++;}
      }else if(key==='paymentDateTime'){
        const v=String(value).trim();
        if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)){$(id).value=v;matched++;}
      }else{
        $(id).value=String(value).trim(); matched++;
      }
    }
  });
  render();
  return matched;
}

async function runAiScan(){
  if(!selectedFiles.length)return;
  $('aiScanBtn').disabled=true;
  $('ocrBtn').disabled=true;
  $('clearFilesBtn').disabled=true;
  $('ocrStatus').textContent='AI is reading the uploaded payment files…';
  try{
    const images=[];
    for(const file of selectedFiles){
      if(file.type==='application/pdf' || /\.pdf$/i.test(file.name)){
        images.push(...await pdfToAiImages(file));
      }else if(file.type.startsWith('image/')){
        images.push(await fileToCompressedImage(file));
      }
      if(images.length>=8)break;
    }
    if(!images.length)throw new Error('No readable images found');
    const response=await fetch('/api/extract',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({images:images.slice(0,8)})
    });
    if(!response.ok){
      const detail=await response.text().catch(()=> '');
      throw new Error(detail||('AI endpoint returned '+response.status));
    }
    const result=await response.json();
    const matched=applyAiFields(result.fields||result);
    $('ocrStatus').textContent='AI scan complete — '+matched+' bill fields filled. Review every value before generating the bill.';
    toast('AI filled '+matched+' bill fields');
  }catch(e){
    console.error(e);
    $('ocrStatus').textContent='AI scan unavailable — Local OCR fallback is ready.';
    toast('AI scan could not run. Use Local OCR Fallback.');
  }finally{
    $('aiScanBtn').disabled=!selectedFiles.length;
    $('ocrBtn').disabled=!selectedFiles.length;
    $('clearFilesBtn').disabled=false;
  }
}

$('aiScanBtn').addEventListener('click',runAiScan);

let selectedFiles=[];
$('screenshotInput').addEventListener('change',e=>{
  selectedFiles=Array.from(e.target.files||[]);
  $('ocrBtn').disabled=!selectedFiles.length;
  $('ocrStatus').textContent=selectedFiles.length
    ? `${selectedFiles.length} file(s) selected — images and PDFs supported`
    : 'No payment files selected';
});

$('clearFilesBtn').addEventListener('click',()=>{
  selectedFiles=[];
  $('screenshotInput').value='';
  $('ocrBtn').disabled=true;
  $('ocrStatus').textContent='No payment files selected';
});

$('ocrBtn').addEventListener('click',async()=>{
  if(!selectedFiles.length)return;
  $('ocrBtn').disabled=true;
  $('clearFilesBtn').disabled=true;
  let worker=null;
  try{
    if(typeof Tesseract==='undefined')throw new Error('OCR library unavailable');
    worker=await Tesseract.createWorker('eng',1,{
      logger:m=>{
        if(m.status==='recognizing text' && typeof m.progress==='number'){
          $('ocrStatus').textContent=`Reading payment file… ${Math.round(m.progress*100)}%`;
        }
      }
    });
    await worker.setParameters({preserve_interword_spaces:'1'});
    const allText=[];
    let fileIndex=0;
    for(const file of selectedFiles){
      fileIndex++;
      const label=`File ${fileIndex}/${selectedFiles.length}: ${file.name}`;
      if(file.type==='application/pdf' || /\.pdf$/i.test(file.name)){
        allText.push(await ocrPdf(file,worker,label));
      }else if(file.type.startsWith('image/')){
        allText.push(await ocrImage(file,worker,label));
      }
    }
    const combined=allText.filter(Boolean).join('\n\n');
    if(!combined.trim())throw new Error('No readable text found in the uploaded files');
    const result=parseOCR(combined);
    $('ocrStatus').textContent=`${selectedFiles.length} file(s) processed — ${result.matched} bill fields updated. Review and edit them before generating.`;
    toast(result.matched ? 'Uploaded payment files updated the bill' : 'Files processed, but no matching fields were found');
  }catch(e){
    console.error(e);
    $('ocrStatus').textContent='Extraction failed — check the files and try again';
    toast('File extraction failed — manual entry is still available');
  }finally{
    if(worker)await worker.terminate();
    $('ocrBtn').disabled=!selectedFiles.length;
    $('clearFilesBtn').disabled=false;
  }
});

fields.forEach(f=>$(f).addEventListener('input',render));
$('generateBtn').addEventListener('click',()=>{if(validateBill()){render();toast('Bill generated — review the A4 preview before saving');}});
$('saveBtn').addEventListener('click',saveData);
$('clearBtn').addEventListener('click',clearNew);
$('downloadBtn').addEventListener('click',pdf);
$('printBtn').addEventListener('click',()=>{if(validateBill()){render();window.print();}});
installHistoryPanel();

(function init(){
  // Always open as a completely blank new bill.
  // Saved bills remain available only in the Saved Bills Dataset panel.
  localStorage.removeItem(DRAFT_KEY);
  setData(blankBill());
  renderHistory();
})();