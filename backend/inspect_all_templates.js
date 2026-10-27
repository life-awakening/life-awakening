require('dotenv').config();

async function inspectAllTemplates() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  console.log('Fetching all approved templates from Meta WABA ID:', wabaId);
  const url = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?status=APPROVED`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    console.log('\n--- Approved Meta Templates ---');
    if (data.data) {
      data.data.forEach(t => {
        console.log(`\nTemplate Name: ${t.name} (Language: ${t.language}, Format: ${t.parameter_format || 'POSITIONAL'})`);
        const bodyComp = t.components?.find(c => c.type === 'BODY');
        if (bodyComp) {
          console.log('Body Text:');
          console.log(bodyComp.text);
        }
      });
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error fetching templates:', err.message);
  }
}

inspectAllTemplates();
