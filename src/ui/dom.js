// Dependency-free DOM primitives and form helpers — the tiny rendering toolkit
// the tab renderers build on. Nothing here knows about ledger constants or state.

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'type') el.type = value;
    else if (key === 'value') el.value = value ?? '';
    else if (key === 'checked') el.checked = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) el.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function field(label, input) {
  return h('label', { class: 'fcl-field' }, [h('span', { text: label }), input]);
}

export function input(name, value = '', attrs = {}) {
  return h('input', { name, value, ...attrs });
}

export function textarea(name, value = '', attrs = {}) {
  return h('textarea', { name, ...attrs }, value ?? '');
}

export function select(name, value, options) {
  const el = h('select', { name });
  for (const option of options) {
    const opt = h('option', { value: option.value ?? option, text: option.label ?? option });
    opt.selected = String(option.value ?? option) === String(value ?? '');
    el.append(opt);
  }
  return el;
}

export function actionbar(buttons) {
  return h('div', { class: 'fcl-actionbar' }, buttons);
}

export function card(title, body, actions = []) {
  return h('section', { class: 'fcl-card' }, [
    h('h4', { text: title }),
    typeof body === 'string' ? h('p', { text: body }) : body,
    actions.length ? actionbar(actions) : null,
  ]);
}

export function staticValue(value, emptyLabel = '未设置') {
  return h('span', { class: 'fcl-static-value', text: value || emptyLabel });
}

export function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function boolValue(value) {
  return value === 'on' || value === 'true' || value === true;
}

export function parseJsonField(value) {
  if (!String(value || '').trim()) return {};
  return JSON.parse(value);
}

export function renderRecordForm(title, fields, submitLabel, onSubmit) {
  const form = h('form', { class: 'fcl-form' }, [
    ...fields,
    h('button', { type: 'submit', class: 'menu_button', text: submitLabel }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit(formDataObject(form), form);
  });
  return h('section', { class: 'fcl-editor' }, [h('h3', { text: title }), form]);
}

export function setStatus(root, message, kind = 'info') {
  const status = root.querySelector('[data-fcl-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

export async function submitWithStatus(root, message, action) {
  try {
    await action();
    setStatus(root, message, 'success');
  } catch (error) {
    console.error('[football-career-ledger]', error);
    setStatus(root, error.message || String(error), 'error');
  }
}
