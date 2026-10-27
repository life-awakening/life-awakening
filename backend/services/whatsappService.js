require('dotenv').config();

/**
 * Sends a WhatsApp message using the Meta WhatsApp Cloud API.
 * Uses built-in node fetch (supported in Node 18+).
 * If the environment is not configured, it logs the message details and mocks a successful dispatch.
 * 
 * @param {Object} options
 * @param {string} options.to   - Recipient phone number (with country code, e.g., '919876543210')
 * @param {string} options.body - Plain text message body
 * @returns {Promise<{ messageId: string }>}
 */
const sendWhatsapp = async ({ to, body }) => {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v25.0').trim();

  // Validate inputs
  if (!to || !to.trim()) {
    throw new Error('Recipient phone number is required.');
  }
  if (!body || !body.trim()) {
    throw new Error('Message body is required.');
  }

  // Format recipient number (strip out non-digits)
  const cleanPhone = to.replace(/\D/g, '');

  // Sandbox/Mock Fallback Mode
  if (!accessToken || !phoneNumberId || accessToken.toLowerCase() === 'mock' || accessToken.toLowerCase() === 'sandbox') {
    const mockId = `mock_wa_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[WhatsApp Sandbox] 📱 Simulated sending WhatsApp to ${cleanPhone}: "${body.substring(0, 100)}..." (Mock Message ID: ${mockId})`);
    return { messageId: mockId };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const maskedToken = `${accessToken.substring(0, 7)}...${accessToken.substring(accessToken.length - 4)}`;
  console.log(`[WhatsApp] Dispatching message to ${cleanPhone} using Phone ID ${phoneNumberId} (Token: ${maskedToken})`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: {
      preview_url: false,
      body: body
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[WhatsApp API Error] Meta responded with status ${res.status}:`, data);
      throw new Error(data.error?.message || `Meta API responded with error status ${res.status}`);
    }

    const messageId = data.messages?.[0]?.id || `wa_msg_${Date.now()}`;
    console.log(`[WhatsApp] Successfully delivered message to ${cleanPhone} via Meta API. ID: ${messageId}`);
    return { messageId };
  } catch (err) {
    const safeError = err.message?.replace(accessToken, '[REDACTED]');
    console.error(`[WhatsApp] Dispatch failed for ${cleanPhone}: ${safeError}`);
    throw err;
  }
};

/**
 * Sends a WhatsApp template message using the Meta WhatsApp Cloud API.
 * Supporting headers, body parameters, and dynamic button suffix.
 */
const sendWhatsappTemplate = async ({ to, templateName, languageCode = 'en', headerImageId, bodyParameters, buttonParameter }) => {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v25.0').trim();

  if (!to || !to.trim()) {
    throw new Error('Recipient phone number is required.');
  }
  if (!templateName || !templateName.trim()) {
    throw new Error('Template name is required.');
  }

  const cleanPhone = to.replace(/\D/g, '');

  // Sandbox/Mock Fallback Mode
  if (!accessToken || !phoneNumberId || accessToken.toLowerCase() === 'mock' || accessToken.toLowerCase() === 'sandbox') {
    const mockId = `mock_wa_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[WhatsApp Sandbox] 📱 Simulated sending template "${templateName}" to ${cleanPhone} (Mock ID: ${mockId})`);
    return { messageId: mockId };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const components = [];

  // Add header image parameter only if headerImageId is explicitly provided
  if (headerImageId && headerImageId !== 'none' && headerImageId !== 'null') {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            id: headerImageId
          }
        }
      ]
    });
  }

  // Add body parameters (supporting both positional strings and named parameter objects)
  if (bodyParameters && Array.isArray(bodyParameters) && bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map(p => {
        if (typeof p === 'object' && p !== null && p.parameter_name) {
          return {
            type: 'text',
            parameter_name: p.parameter_name,
            text: String(p.text || '')
          };
        }
        return {
          type: 'text',
          text: typeof p === 'object' && p !== null ? String(p.text || '') : String(p)
        };
      })
    });
  }

  // Add button parameter if present
  if (buttonParameter) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: buttonParameter
        }
      ]
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error?.message || `Meta API error ${res.status}`;
      console.error(`[WhatsApp API Error] Meta responded with status ${res.status}:`, data);
      throw new Error(errorMsg);
    }

    const messageId = data.messages?.[0]?.id || `wa_msg_${Date.now()}`;
    console.log(`[WhatsApp] Successfully delivered template "${templateName}" to ${cleanPhone} via Meta API. ID: ${messageId}`);
    return { messageId };
  } catch (err) {
    const safeError = err.message?.replace(accessToken, '[REDACTED]');
    console.error(`[WhatsApp] Template dispatch failed for ${cleanPhone}: ${safeError}`);
    throw err;
  }
};

/**
 * Uploads media (welcome banner image) to Meta's WhatsApp Media API.
 */
const uploadMetaMedia = async (fileBuffer, mimeType, filename) => {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v25.0').trim();

  if (!accessToken || !phoneNumberId || accessToken.toLowerCase() === 'mock' || accessToken.toLowerCase() === 'sandbox') {
    const mockMediaId = `mock_media_${Date.now()}`;
    console.log(`[WhatsApp Sandbox] 📱 Simulated media upload (Mock ID: ${mockMediaId})`);
    return { mediaId: mockMediaId };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`;

  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[WhatsApp API Error] Meta media upload responded with status ${res.status}:`, data);
      throw new Error(data.error?.message || `Meta media upload error status ${res.status}`);
    }

    const mediaId = data.id;
    console.log(`[WhatsApp] Media uploaded successfully. ID: ${mediaId}`);
    return { mediaId };
  } catch (err) {
    const safeError = err.message?.replace(accessToken, '[REDACTED]');
    console.error(`[WhatsApp] Media upload failed: ${safeError}`);
    throw new Error(safeError);
  }
};

module.exports = {
  sendWhatsapp,
  sendWhatsappTemplate,
  uploadMetaMedia
};
