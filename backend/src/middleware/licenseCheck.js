const jwt = require('jsonwebtoken');

const LICENSE_SECRET = process.env.JWT_SECRET || 'm1_turno_sup3r_s3cret_jwt_k3y_2026';

/**
 * Middleware y Verificador de Licencia Comercial On-Premise
 */
function verifyOnPremiseLicense() {
  const licenseKey = process.env.LICENSE_KEY;

  if (!licenseKey || !licenseKey.trim()) {
    console.log('ℹ️ [Licencia] No se detectó LICENSE_KEY en .env — Operando en Modo Licencia de Prueba / Evaluación.');
    return { valid: true, mode: 'trial', clientName: 'Evaluación On-Premise' };
  }

  try {
    const decoded = jwt.verify(licenseKey.trim(), LICENSE_SECRET);
    const now = new Date();
    const expiry = new Date(decoded.expires_at);

    if (now > expiry) {
      console.warn(`⚠️ [Licencia Expirada] La licencia de "${decoded.client_name}" venció el ${decoded.expires_at}.`);
      return {
        valid: false,
        clientName: decoded.client_name,
        expiresAt: decoded.expires_at,
        error: `Licencia Comercial On-Premise Vencida (${decoded.expires_at}). Contacte a aguzman0522@gmail.com`
      };
    }

    console.log(`✅ [Licencia On-Premise Activa] Cliente: "${decoded.client_name}" | Válida hasta: ${decoded.expires_at}`);
    return {
      valid: true,
      mode: 'commercial',
      clientName: decoded.client_name,
      expiresAt: decoded.expires_at
    };
  } catch (err) {
    console.warn('⚠️ [Licencia Inválida] LICENSE_KEY en .env no pudo ser verificada.');
    return {
      valid: false,
      error: 'Clave de licencia On-Premise no válida. Contacte a aguzman0522@gmail.com'
    };
  }
}

// Express Middleware para verificar validez en peticiones sensibles de API
function licenseGuard(req, res, next) {
  const check = verifyOnPremiseLicense();
  if (!check.valid) {
    return res.status(402).json({
      error: check.error || 'Licencia On-Premise Vencida o Inválida',
      contact: 'aguzman0522@gmail.com'
    });
  }
  req.licenseInfo = check;
  next();
}

module.exports = {
  verifyOnPremiseLicense,
  licenseGuard
};
