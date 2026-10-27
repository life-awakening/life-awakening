require('dotenv').config();

async function inspectAllTemplates() {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const bId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${bId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('--- ALL META REGISTERED TEMPLATES ---');
    if (data.data) {
      data.data.forEach(t => {
        console.log(`- Template Name: ${t.name} | Category: ${t.category} | Language: ${t.language} | Status: ${t.status}`);
      });
    } else {
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('Error querying Meta templates:', err.message);
  }
}

inspectAllTemplates();
