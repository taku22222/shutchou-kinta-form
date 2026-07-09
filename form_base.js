/* ─────── 出張整体キンタ｜受付フォーム 共通ロジック ─────── */
/*
 * 使い方：
 *   1. <script src="form_base.js"></script> を読み込む
 *   2. その後 initForm(cfg) を呼ぶ。cfg の形：
 *      {
 *        formType: 'body' | 'body_mind' | 'body_ai' | 'full',
 *        formLabel: '体のことフォーム',
 *        totalSteps: 4,
 *        categoryStep: null | 2,         // STEP 2 がカテゴリ選択になっている場合のSTEP番号
 *        detailStep:   null | 3,         // STEP 3 が動的詳細表示の場合
 *        gasUrl:       'https://script.google.com/...',
 *        lineUrl:      'https://line.me/R/ti/p/...',
 *        storageKey:   'kinta_form_body_v1'
 *      }
 */

// ─────── 状態管理 ───────
let currentStep = 1;
let TOTAL_STEPS = 4;
let STORAGE_KEY = "kinta_form_default_v1";
let CFG = {};

function initForm(cfg) {
  CFG = cfg;
  TOTAL_STEPS = cfg.totalSteps || 4;
  STORAGE_KEY = cfg.storageKey || "kinta_form_default_v1";
  loadDraft();
  updateProgress();
  bindEvents();
}

function updateProgress() {
  const pct = (currentStep / TOTAL_STEPS) * 100;
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressLabel');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `STEP ${currentStep} / ${TOTAL_STEPS}`;
}

function showStep(n) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.step[data-step="${n}"]`);
  if (target) target.classList.add('active');
  currentStep = n;
  updateProgress();
  // 動的詳細ステップに入った時、選択されたカテゴリだけ可視化
  if (CFG.detailStep && n === CFG.detailStep) refreshDetailCards();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  saveDraft();
  let next = currentStep + 1;
  // カテゴリステップ → 詳細ステップに進む際、何も選んでなければ詳細をスキップ
  if (CFG.categoryStep && CFG.detailStep && currentStep === CFG.categoryStep) {
    if (!hasAnyCategory()) {
      next = CFG.detailStep + 1; // 詳細スキップ
    }
  }
  if (next <= TOTAL_STEPS) showStep(next);
}

function prevStep() {
  saveDraft();
  let prev = currentStep - 1;
  // 詳細ステップの後ろから戻ってくる時、何も選んでなければ詳細をスキップ
  if (CFG.categoryStep && CFG.detailStep && currentStep === CFG.detailStep + 1) {
    if (!hasAnyCategory()) {
      prev = CFG.categoryStep;
    }
  }
  if (prev >= 1) showStep(prev);
}

function hasAnyCategory() {
  return document.querySelectorAll('input[name="category"]:checked').length > 0;
}

// ─────── 動的詳細カードの表示 ───────
function refreshDetailCards() {
  const selected = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(i => i.value);
  document.querySelectorAll('.cat-card').forEach(card => {
    const cat = card.getAttribute('data-cat');
    card.classList.toggle('active', selected.includes(cat));
  });
}

// ─────── Chip UI ───────
function bindChipUI() {
  document.querySelectorAll('.chip input, .bigchip input').forEach(input => {
    input.addEventListener('change', e => {
      const chip = e.target.closest('.chip') || e.target.closest('.bigchip');
      if (input.type === 'radio') {
        document.querySelectorAll(`input[name="${input.name}"]`).forEach(r => {
          const c = r.closest('.chip') || r.closest('.bigchip');
          if (c) c.classList.remove('checked');
        });
      }
      if (chip) chip.classList.toggle('checked', input.checked);

      // メール選択時にメールフィールド表示
      if (input.name === 'contact') {
        const emailInput = document.querySelector('input[name="contact"][value="メール"]');
        const emailField = document.getElementById('emailField');
        if (emailInput && emailField) emailField.style.display = emailInput.checked ? 'block' : 'none';
      }
      saveDraft();
    });
  });
}

// ─────── データ取得 ───────
function getFormData() {
  const form = document.getElementById('contactForm');
  if (!form) return {};
  const fd = new FormData(form);
  const obj = {};
  for (const [key, value] of fd.entries()) {
    if (obj[key]) {
      if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
      obj[key].push(value);
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

// ─────── 自動保存 ───────
function saveDraft() {
  try {
    const data = { ...getFormData(), step: currentStep, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const a = document.getElementById('autoSave');
    if (a) {
      a.style.display = 'block';
      clearTimeout(window._asTimer);
      window._asTimer = setTimeout(() => { a.style.display = 'none'; }, 1500);
    }
  } catch (e) { /* ignore */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Date.now() - (data.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    Object.keys(data).forEach(key => {
      if (key === 'step' || key === 'savedAt') return;
      const els = document.querySelectorAll(`[name="${key}"]`);
      if (!els.length) return;
      const values = Array.isArray(data[key]) ? data[key] : [data[key]];
      els.forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = values.includes(el.value);
          const chip = el.closest('.chip') || el.closest('.bigchip');
          if (chip) chip.classList.toggle('checked', el.checked);
        } else {
          el.value = values[0];
        }
      });
    });
    const emailInput = document.querySelector('input[name="contact"][value="メール"]');
    const emailField = document.getElementById('emailField');
    if (emailInput && emailField && emailInput.checked) emailField.style.display = 'block';
  } catch (e) { /* ignore */ }
}

// ─────── 送信 ───────
async function submitForm() {
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '送信中...'; }

  const data = getFormData();
  data.form_type = CFG.formType || 'unknown';
  data.form_label = CFG.formLabel || '';
  data.submittedAt = new Date().toISOString();
  data.userAgent = navigator.userAgent.substring(0, 100);

  try {
    await fetch(CFG.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    localStorage.removeItem(STORAGE_KEY);
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.safety').style.display = 'none';
    document.querySelector('.progress').style.display = 'none';
    const a = document.getElementById('autoSave'); if (a) a.style.display = 'none';
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('doneBox').classList.add('active');
    // LINE登録ボタンのURLを差し込み
    const lineBtn = document.getElementById('lineCtaBtn');
    if (lineBtn && CFG.lineUrl) lineBtn.href = CFG.lineUrl;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    alert('送信中にエラーが発生しました。\n再度お試しいただくか、直接LINEでご連絡ください。');
    if (btn) { btn.disabled = false; btn.textContent = '送信する 📨'; }
  }
}

// ─────── イベント束縛 ───────
function bindEvents() {
  bindChipUI();
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', saveDraft);
  });
}

// グローバル公開（HTML側の onclick から呼ぶため）
window.nextStep = nextStep;
window.prevStep = prevStep;
window.submitForm = submitForm;
window.initForm = initForm;
