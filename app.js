const $ = id => document.getElementById(id);

const fields = ['invoiceNo','invoiceDate','dueDate','clientName','clientUpi','project','service','paymentMethod','projectTotal','currentPayment','previousReceived','utr','transactionId','paymentDateTime','receivedIn','payerUpi','debitedFrom','recipient','recipientUpi','notes'];

const demo = {
  invoiceNo:'SAM-INV-2026-019', invoiceDate:'2026-09-19', dueDate:'2026-09-19',
  clientName:'Anuradha S Raju', clientUpi:'ashaara203@ibl', project:'CALISTA VITA',
  service:'Custom Service Marketplace Website Development', paymentMethod:'UPI / PhonePe',
  projectTotal:0, currentPayment:1000, previousReceived:0,
  utr:'643620717122', transactionId:'T2609120929453063213453',
  paymentDateTime:'2026-09-19T13:44', receivedIn:'Canara Bank •••• 6599',
  payerUpi:'ashaara203@ibl', debitedFrom:'Account ending 25',
  recipient:'SANTHOSH S', recipientUpi:'santhosh.410@superyes',
  notes:'This is a payment received toward the CALISTA VITA project.\nPayment was received through UPI; sender and recipient details are recorded above.\nThis invoice is computer generated and does not require a signature.'
};

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
function clearNew(){
  localStorage.setItem(SEQ_KEY,String(Number(localStorage.getItem(SEQ_KEY)||20)+1));
  const d={...demo,invoiceNo:nextInvoice(),invoiceDate:today(),dueDate:today(),currentPayment:0,previousReceived:0,projectTotal:0,utr:'',transactionId:'',paymentDateTime:'',receivedIn:'',payerUpi:'',debitedFrom:'',notes:'This is a payment received toward the project.\nPayment was received through UPI; sender and recipient details are recorded above.\nThis invoice is computer generated and does not require a signature.'};
  localStorage.removeItem(SAVED_KEY);
  localStorage.removeItem(DRAFT_KEY);
  setData(d);
  localStorage.removeItem(DRAFT_KEY);
  toast('New bill ready — previous draft cleared');
}
function loadExample(){
  setData({...demo});
  toast('Reference example loaded');
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
    .replace(/[|]/g,'I')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/\u00a0/g,' ')
    .replace(/[ \t]+/g,' ')
    .trim();
}

function firstMatch(text, patterns){
  for(const re of patterns){
    const m=text.match(re);
    if(m && m[1]) return m[1].trim();
  }
  return '';
}

function normalizeAmount(value){
  const n=String(value||'').replace(/[₹Rs.INR\s,]/gi,'').replace(/[^0-9.]/g,'');
  const v=Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseOCR(text){
  const raw=cleanOCRText(text);
  const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const flat=lines.join(' ');

  const amountText=firstMatch(flat,[
    /(?:amount\s*(?:received|paid|sent)|payment\s*(?:received|amount)|total\s*amount\s*received|paid\s*amount|transaction\s*amount)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i
  ]);
  const utr=firstMatch(flat,[
    /(?:upi\s*reference|upi\s*ref(?:erence)?|utr|rrn|reference\s*(?:no|number)?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{5,})/i
  ]);
  const txn=firstMatch(flat,[
    /(?:phonepe\s*)?(?:transaction\s*(?:id|number)|txn\s*(?:id|no|number))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{8,})/i
  ]);
  const upis=[...flat.matchAll(/\b[A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,}\b/gi)].map(m=>m[0]);
  const payerUpi=firstMatch(flat,[
    /(?:payer|sender|debited\s*(?:from)?|from)\s*(?:upi\s*)?(?:id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,})/i
  ]) || upis[0] || '';
  const recipientUpi=firstMatch(flat,[
    /(?:recipient|receiver|paid\s*to|credited\s*to)\s*(?:upi\s*)?(?:id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._-]{1,}@[A-Z0-9._-]{2,})/i
  ]) || upis[1] || '';

  const client=firstMatch(flat,[
    /(?:payment\s*received\s*from|received\s*from|payer\s*name|sender\s*name|client\s*name)\s*[:#\-]?\s*([A-Za-z][A-Za-z .'-]{2,})/i
  ]);
  const paidTo=firstMatch(flat,[
    /(?:recipient\s*\/?\s*paid\s*to|recipient\s*name|receiver\s*name|paid\s*to|credited\s*to)\s*[:#\-]?\s*([A-Za-z][A-Za-z .'-]{2,})/i
  ]);
  const receivedIn=firstMatch(flat,[
    /(?:received\s*in|credited\s*in|credited\s*to\s*(?:bank|account)?|bank\s*account)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9 .•*#()_-]{2,})/i
  ]);
  const debitedFrom=firstMatch(flat,[
    /(?:debited\s*from|debit(?:ed)?\s*account|paid\s*from)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9 .•*#()_-]{2,})/i
  ]);
  const dateTime=firstMatch(flat,[
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s+(?:at\s+)?\d{1,2}:\d{2}(?:\s*[AP]M)?)/i,
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+(?:at\s+)?\d{1,2}:\d{2}(?:\s*[AP]M)?)/i
  ]);

  if(amountText) $('currentPayment').value=normalizeAmount(amountText);
  if(utr) $('utr').value=utr.replace(/[^A-Za-z0-9-]/g,'');
  if(txn) $('transactionId').value=txn.replace(/[^A-Za-z0-9-]/g,'');
  if(payerUpi) $('payerUpi').value=payerUpi;
  if(recipientUpi) $('recipientUpi').value=recipientUpi;
  if(client) $('clientName').value=client.replace(/\s{2,}/g,' ').trim();
  if(paidTo) $('recipient').value=paidTo.replace(/\s{2,}/g,' ').trim();
  if(receivedIn) $('receivedIn').value=receivedIn.trim();
  if(debitedFrom) $('debitedFrom').value=debitedFrom.trim();

  if(dateTime){
    const normalized=dateTime.replace(/\bat\b/i,' ').replace(/\s+/g,' ').trim();
    const m=normalized.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
    if(m){
      let y=Number(m[3]); if(y<100)y+=2000;
      let hh=Number(m[4]); const ap=(m[6]||'').toUpperCase();
      if(ap==='PM' && hh<12)hh+=12;
      if(ap==='AM' && hh===12)hh=0;
      $('paymentDateTime').value=`${y.toString().padStart(4,'0')}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${hh.toString().padStart(2,'0')}:${m[5]}`;
    }
  }

  render();
  return {
    amount:amountText ? normalizeAmount(amountText) : 0,
    utr, txn, payerUpi, recipientUpi, client, paidTo, receivedIn, debitedFrom, dateTime,
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
$('loadDemoBtn').addEventListener('click',loadExample);
$('downloadBtn').addEventListener('click',pdf);
$('printBtn').addEventListener('click',()=>{if(validateBill()){render();window.print();}});
installHistoryPanel();

(function init(){
  const saved=localStorage.getItem(SAVED_KEY);
  const draft=localStorage.getItem(DRAFT_KEY);
  if(saved)setData(JSON.parse(saved));
  else if(draft)setData(JSON.parse(draft));
  else setData({...demo,invoiceNo:nextInvoice(),invoiceDate:today(),dueDate:today(),currentPayment:0,previousReceived:0,projectTotal:0,utr:'',transactionId:'',paymentDateTime:'',receivedIn:'',payerUpi:'',debitedFrom:''});
  renderHistory();
})();