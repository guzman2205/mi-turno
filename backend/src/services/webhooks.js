const crypto = require('crypto');
const Webhook = require('../models/Webhook');

/**
 * Despacha eventos en tiempo real a las URLs de Webhooks registradas
 */
async function dispatchWebhook(event, payload) {
  try {
    const hooks = await Webhook.findAll({ where: { active: true } });
    if (!hooks || hooks.length === 0) return;

    for (const hook of hooks) {
      if (Array.isArray(hook.events) && hook.events.includes(event)) {
        const body = JSON.stringify({ event, data: payload, timestamp: new Date() });
        const signature = hook.secret
          ? crypto.createHmac('sha256', hook.secret).update(body).digest('hex')
          : '';

        fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MiTurno-Event': event,
            ...(signature ? { 'X-MiTurno-Signature': signature } : {})
          },
          body
        }).then(async (res) => {
          if (res.ok) {
            await hook.update({ last_triggered_at: new Date() });
          }
        }).catch((err) => {
          console.warn(`[Webhook Error ${hook.url}]:`, err.message);
        });
      }
    }
  } catch (err) {
    console.warn('[Webhook Dispatch Error]:', err.message);
  }
}

module.exports = {
  dispatchWebhook
};
