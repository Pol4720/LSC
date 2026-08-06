/* =========================================================================
   LSC · Validation (pure, no DOM — unit-testable in Node)
   ========================================================================= */

import { isEmpty, deepGet } from './core.js';
import { isRequired, visibleSteps, visibleFields } from './schema.js';

export const RE = {
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  url: /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i,
  zip: /^\d{5}(-\d{4})?$/,
};

/** Accepts +1 786 555 0100, (786) 555-0100, 7865550100 … 7-15 digits. */
export function isValidPhone(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (!/^\+?[\d\s().\-/]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Parse an 'err.key:param' shorthand into {key, vars}. */
function parseRule(rule) {
  if (!rule) return null;
  if (typeof rule === 'object') return rule;
  const [key, param] = String(rule).split(':');
  if (param === undefined) return { key, vars: undefined };
  const varName = key.endsWith('minLen') || key.endsWith('min') || key.endsWith('minSelect') ? 'min' : 'max';
  return { key, vars: { [varName]: param } };
}

/**
 * Validate a single field value.
 * @returns {{key:string, vars?:object}|null} null when valid
 */
export function validateField(field, value, data) {
  if (!field || field.type === 'info') return null;

  const required = isRequired(field, data);
  const empty = field.type === 'switch' ? value !== true : isEmpty(value);

  if (required && empty) return { key: 'err.required' };
  if (empty && !required) return null;

  switch (field.type) {
    case 'email':
      if (!RE.email.test(String(value).trim())) return { key: 'err.email' };
      break;
    case 'tel':
      if (!isValidPhone(value)) return { key: 'err.phone' };
      break;
    case 'url':
      if (!RE.url.test(String(value).trim())) return { key: 'err.url' };
      break;
    case 'number':
    case 'money':
    case 'slider': {
      const n = Number(value);
      if (!Number.isFinite(n)) return { key: 'err.number' };
      if (field.min !== undefined && n < field.min) return { key: 'err.min', vars: { min: field.min } };
      if (field.max !== undefined && n > field.max) return { key: 'err.max', vars: { max: field.max } };
      break;
    }
    case 'year': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear() + 2) return { key: 'err.year' };
      break;
    }
    case 'yearrange': {
      const { from, to } = value || {};
      if (!Number.isFinite(Number(from)) || !Number.isFinite(Number(to))) return { key: 'err.year' };
      if (Number(from) > Number(to)) return { key: 'err.year' };
      break;
    }
    case 'multi':
    case 'chips':
    case 'tags':
    case 'priority': {
      const arr = Array.isArray(value) ? value : [];
      if (field.minSelect && arr.length < field.minSelect) return { key: 'err.minSelect', vars: { min: field.minSelect } };
      if (field.max && arr.length > field.max) return { key: 'err.maxSelect', vars: { max: field.max } };
      break;
    }
    default:
      break;
  }

  if (typeof value === 'string') {
    const len = value.trim().length;
    if (field.minLength && len < field.minLength) return { key: 'err.minLen', vars: { min: field.minLength } };
    if (field.maxLength && len > field.maxLength) return { key: 'err.maxLen', vars: { max: field.maxLength } };
    if (field.pattern && !new RegExp(field.pattern).test(value)) return { key: 'err.pattern' };
  }

  if (typeof field.validate === 'function') {
    const custom = field.validate(value, data);
    if (custom) return parseRule(custom);
  }
  return null;
}

/**
 * Validate every visible field of a step.
 * @returns {Record<string, {key:string, vars?:object}>} errors by field id
 */
export function validateStep(step, data, mode = 'full') {
  const errors = {};
  for (const field of visibleFields(step, data, mode)) {
    const err = validateField(field, deepGet(data, field.id), data);
    if (err) errors[field.id] = err;
  }
  return errors;
}

/** Validate the whole questionnaire. */
export function validateAll(data, mode = 'full') {
  const errors = {};
  for (const step of visibleSteps(mode)) Object.assign(errors, validateStep(step, data, mode));
  return errors;
}

/**
 * Completion metrics for progress UI: answered / total visible fields.
 */
export function completeness(data, mode = 'full') {
  let total = 0, answered = 0, requiredTotal = 0, requiredAnswered = 0;
  for (const step of visibleSteps(mode)) {
    for (const field of visibleFields(step, data, mode)) {
      if (field.type === 'info') continue;
      total++;
      const v = deepGet(data, field.id);
      const filled = field.type === 'switch' ? v === true : !isEmpty(v);
      if (filled) answered++;
      if (isRequired(field, data)) {
        requiredTotal++;
        if (filled) requiredAnswered++;
      }
    }
  }
  return {
    total, answered, requiredTotal, requiredAnswered,
    percent: total ? Math.round((answered / total) * 100) : 0,
    requiredPercent: requiredTotal ? Math.round((requiredAnswered / requiredTotal) * 100) : 100,
    ready: requiredAnswered === requiredTotal,
  };
}
