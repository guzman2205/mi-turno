const { validationResult } = require('express-validator');

/**
 * Middleware para validar el resultado de express-validator.
 * Si existen errores de validación, retorna HTTP 422 con el desglose de campos erróneos.
 */
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Datos de entrada inválidos',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};
