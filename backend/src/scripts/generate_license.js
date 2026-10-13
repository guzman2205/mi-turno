/**
 * Herramienta de Generación de Licencias Comerciales On-Premise para Mi Turno
 * Uso: node backend/src/scripts/generate_license.js "Nombre del Cliente" "YYYY-MM-DD"
 */
const jwt = require('jsonwebtoken');

const LICENSE_SECRET = process.env.JWT_SECRET || 'm1_turno_sup3r_s3cret_jwt_k3y_2026';

const args = process.argv.slice(2);
const clientName = args[0] || 'Cliente Comercial On-Premise';
const expiryDateStr = args[1] || '2027-12-31';

const payload = {
  client_name: clientName,
  expires_at: expiryDateStr,
  issued_at: new Date().toISOString().slice(0, 10),
  type: 'on_premise'
};

const token = jwt.sign(payload, LICENSE_SECRET);

console.log('================================================================');
console.log('🔑 GENERADOR DE LICENCIAS COMERCIALES ON-PREMISE — MI TURNO');
console.log('================================================================');
console.log(`🏢 Cliente / Empresa: ${clientName}`);
console.log(`📅 Vencimiento:       ${expiryDateStr}`);
console.log('----------------------------------------------------------------');
console.log('Copia esta línea en el archivo .env del servidor de tu cliente:\n');
console.log(`LICENSE_KEY=${token}\n`);
console.log('================================================================');
