function createValidationError(message, details = null) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function asTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function requireString(value, field, message) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    throw createValidationError(message || `${field} é obrigatório.`, [{ field }]);
  }
  return normalized;
}

function optionalString(value) {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || '';
}

function requireEnum(value, allowedValues, field, message) {
  if (!allowedValues.includes(value)) {
    throw createValidationError(message || `${field} inválido.`, [{ field, allowedValues }]);
  }
  return value;
}

function requireArray(value, field, message) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError(message || `${field} deve ser um array não vazio.`, [{ field }]);
  }
  return value;
}

function optionalBase64Image(value, field, message) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (!/^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(value)) {
    throw createValidationError(message || `${field} em formato inválido.`, [{ field }]);
  }

  return value;
}

module.exports = {
  asTrimmedString,
  requireString,
  optionalString,
  requireEnum,
  requireArray,
  optionalBase64Image
};
