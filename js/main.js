let recipes = [];
let itemsById = {};
let translations = {};
let currentLang = localStorage.getItem('lang') || 'pt';
let selectedRecipe = null;
let formatter;

// --- i18n helper ---
function t(key, params) {
  let str = translations;
  key.split('.').forEach(k => {
    if (str && str[k] !== undefined) str = str[k];
    else str = null;
  });
  if (!str) return key;
  if (params) {
    Object.keys(params).forEach(p => {
      str = str.replace(new RegExp(`{${p}}`, 'g'), params[p]);
    });
  }
  return str;
}

function getLocaleTag(lang) {
  const tags = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', pl: 'pl-PL' };
  return tags[lang] || 'en-US';
}

async function loadLocale(lang) {
  const res = await fetch(`locales/${lang}.json`);
  translations = await res.json();
  formatter = new Intl.NumberFormat(getLocaleTag(lang));
  document.documentElement.lang = lang;
  document.title = t('app.title');
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;
    const val = t(key);
    if (!val) return;
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  });
  const feeLbl = document.getElementById('lbl-fee');
  if (feeLbl) feeLbl.textContent = t('ui.feeLabel', { percent: 3 });
}

function formatBerry(value) {
  const symbol = translations?.currency?.berry?.symbol || 'Ƀ';
  return `${symbol} ${formatter.format(Number(value) || 0)}`;
}

// --- Data load ---
async function loadData() {
  const resRecipes = await fetch('recipes.json');
  recipes = await resRecipes.json();

  const resItems = await fetch('items.json');
  const items = await resItems.json();
  itemsById = {};
  items.forEach(it => { itemsById[it.id] = it; });
}

// --- Build UI ---
function buildRecipeList() {
  const list = document.getElementById('recipe-list');
  list.innerHTML = '';

  recipes.forEach(r => {
    const item = document.createElement('div');
    item.className = 'recipe-item';
    item.tabIndex = 0;
    item.addEventListener('click', () => selectRecipe(r));
    item.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') selectRecipe(r);
    });

    const img = document.createElement('img');
    img.src = r.sprite;
    img.alt = t(r.labelKey);
    img.width = 48;
    img.height = 48;
    img.style.borderRadius = '6px';

    const textBox = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'recipe-name';
    name.textContent = t(r.labelKey);

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    meta.textContent = `${t('ui.levelLabel')} ${r.level} — ${r.cooldown}${t('ui.secondsSuffix')}`;

    textBox.appendChild(name);
    textBox.appendChild(meta);

    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.appendChild(img);
    item.appendChild(textBox);

    list.appendChild(item);
  });
}

function selectRecipe(r) {
  selectedRecipe = r;
  document.getElementById('recipe-name').textContent = t(r.labelKey);
  document.getElementById('recipe-level').textContent = `${t('ui.levelLabel')} ${r.level}`;
  document.getElementById('recipe-cooldown').textContent = `${r.cooldown}${t('ui.secondsSuffix')}`;

  const ingList = document.getElementById('ingredients-list');
  ingList.innerHTML = '';

  r.ingredients.forEach(ing => {
    const itemData = itemsById[ing.id];
    if (!itemData) return;

    // Contêiner de toda a linha
    const row = document.createElement('div');
    row.className = 'ingredient';
    row.dataset.id = ing.id;

    // Coluna 1: Sprite
    const img = document.createElement('img');
    img.src = itemData.sprite;
    img.alt = t(itemData.labelKey);
    img.width = 32;
    img.height = 32;
    img.style.objectFit = 'contain';

    // Coluna 2: Nome
    const name = document.createElement('span');
    name.className = 'ingredient-name';
    name.textContent = t(itemData.labelKey);

    // Coluna 3: Quantidade + valor
    const qtyValContainer = document.createElement('div');
    qtyValContainer.style.textAlign = 'right';

    const qtySpan = document.createElement('div');
    qtySpan.className = 'ingredient-qty';
    qtySpan.textContent = `× ${ing.quantity}`;

    const valSpan = document.createElement('div');
    valSpan.className = 'ingredient-value';
    valSpan.style.color = '#ffcc00';
    valSpan.textContent = formatBerry(itemData.value * ing.quantity);

    qtyValContainer.appendChild(qtySpan);
    qtyValContainer.appendChild(valSpan);

    // Montagem da linha
    row.appendChild(img);
    row.appendChild(name);
    row.appendChild(qtyValContainer);

    ingList.appendChild(row);
  });

  updatePanelValues();
}

// --- Calculations ---
function updatePanelValues() {
  const qtyInput = document.getElementById('qty');
  let qty = parseInt(qtyInput.value, 10);

  // Normaliza quantidade: mínimo 1, máximo 100
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  if (qty > 100) qty = 100;
  qtyInput.value = qty;

  if (!selectedRecipe) return;

  let unitCost = 0;

  // atualiza cada ingrediente conforme quantidade desejada
  selectedRecipe.ingredients.forEach(ing => {
    const item = itemsById[ing.id];
    if (!item) return;

    // soma ao custo unitário (sem multiplicar pela qty global ainda)
    unitCost += item.value * ing.quantity;

    // atualiza display
    const row = document.querySelector(`.ingredient[data-id="${ing.id}"]`);
    if (row) {
      row.querySelector('.ingredient-qty').textContent = `× ${ing.quantity * qty}`;
      row.querySelector('.ingredient-value').textContent = formatBerry(item.value * ing.quantity * qty);
    }
  });

  const totalCost = unitCost * qty;
  const sellPrice = parseFloat(document.getElementById('sell-price').value) || 0;
  const fee = Math.round(sellPrice * qty * 0.03);
  const profit = Math.round(sellPrice * qty - totalCost - fee);

  document.getElementById('unit-cost').textContent = formatBerry(unitCost);
  document.getElementById('total-cost').textContent = formatBerry(totalCost);
  document.getElementById('fee').textContent = formatBerry(fee);

  // Aplicar cor dinâmica ao lucro
  const profitEl = document.getElementById('profit');
  profitEl.textContent = formatBerry(profit);
  profitEl.classList.remove('profit', 'loss');
  if (profit > 0) {
    profitEl.classList.add('profit');
  } else if (profit < 0) {
    profitEl.classList.add('loss');
  }
}

// --- Events ---
document.querySelectorAll('#lang-selector button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const lang = btn.dataset.lang;
    if (lang && lang !== currentLang) {
      currentLang = lang;
      localStorage.setItem('lang', lang);
      await loadLocale(currentLang);
      buildRecipeList();
      if (selectedRecipe) selectRecipe(selectedRecipe);
    }
  });
});

document.getElementById('qty').addEventListener('input', updatePanelValues);
document.getElementById('sell-price').addEventListener('input', updatePanelValues);

// --- Init ---
(async function init() {
  try {
    await loadLocale(currentLang);
    await loadData();
    buildRecipeList();
  } catch (e) {
    console.error(e);
    alert(t('ui.loadingError'));
  }
})();