require('dotenv').config();

async function inspectDetails() {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const bId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();

  const templates = ['lrp_welcome_marketing', 'lrp_welcome_student_v1', 'ltc_notification'];

  for (const name of templates) {
    try {
      const res = await fetch(`https://graph.facebook.com/v25.0/${bId}/message_templates?name=${name}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(`\n=================== ${name} ===================`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e);
    }
  }
}

inspectDetails();
