require('dotenv').config();

async function inspectTemplate() {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const bId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
  
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${bId}/message_templates?name=lrp_welcome_marketing`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Template details:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error querying Meta:', err.message);
  }
}

inspectTemplate();
