export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  try {
    const body = req.body || {};
    const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    if (!images.length) return res.status(400).json({ error: 'No images supplied.' });
    for (const image of images) {
      if (typeof image !== 'string' || !image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image input.' });
      }
      if (image.length > 6_000_000) return res.status(413).json({ error: 'One image is too large.' });
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        invoiceNo:{type:'string'}, invoiceDate:{type:'string'}, dueDate:{type:'string'},
        clientName:{type:'string'}, clientUpi:{type:'string'}, project:{type:'string'},
        service:{type:'string'}, paymentMethod:{type:'string'}, projectTotal:{type:'string'},
        currentPayment:{type:'string'}, previousReceived:{type:'string'}, utr:{type:'string'},
        transactionId:{type:'string'}, paymentDateTime:{type:'string'}, receivedIn:{type:'string'},
        payerUpi:{type:'string'}, debitedFrom:{type:'string'}, recipient:{type:'string'},
        recipientUpi:{type:'string'}, notes:{type:'string'}
      },
      required:[
        'invoiceNo','invoiceDate','dueDate','clientName','clientUpi','project','service',
        'paymentMethod','projectTotal','currentPayment','previousReceived','utr','transactionId',
        'paymentDateTime','receivedIn','payerUpi','debitedFrom','recipient','recipientUpi','notes'
      ]
    };

    const content = [{
      type:'input_text',
      text:
        'Extract payment/bill details from these uploaded screenshots or PDF page images. ' +
        'Return only details that are visibly present. Never invent, infer, autocomplete, or guess. ' +
        'Preserve names, UPI IDs, references and transaction IDs exactly as legible. ' +
        'If a field is not visible or is uncertain, return an empty string. ' +
        'For money fields return digits only when clearly shown. For invoiceDate/dueDate use YYYY-MM-DD only when clearly shown. ' +
        'For paymentDateTime use YYYY-MM-DDTHH:mm only when clearly shown; otherwise empty. ' +
        'Use the payment fields for payment screenshots. A client name may be copied into clientName only when the source clearly identifies it as payer/client/sender. ' +
        'Do not treat arbitrary numbers as transaction IDs or amounts.'
    }];
    for (const image of images) content.push({type:'input_image', image_url:image, detail:'high'});

    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        input:[{role:'user',content}],
        text:{format:{type:'json_schema',name:'bill_extraction',strict:true,schema}}
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenAI request failed.' });
    const text = data.output_text || '';
    let fields;
    try { fields = JSON.parse(text); } catch { return res.status(502).json({ error:'AI returned invalid structured data.' }); }
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).json({ fields });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error:'AI extraction failed on the server.' });
  }
}
