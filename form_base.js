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
  injectHoneypot();
  loadDraft();
  injectClearControl();
  refreshClearControl();
  updateProgress();
  bindEvents();
}

// ─────── 共有端末向け：入力内容を手動消去するリンクを注入 ───────
// 下書きは端末内に最大3日残るため、家族共有のiPad等で「自分の入力を消したい」時に使う。
function injectClearControl() {
  const foot = document.querySelector('.foot');
  if (!foot || document.getElementById('clearDraftWrap')) return;
  const p = document.createElement('p');
  p.id = 'clearDraftWrap';
  p.style.cssText = 'text-align:center; margin-top:14px; display:none;';
  p.innerHTML = '<a id="clearDraftBtn" href="#" style="color:var(--text-soft); font-size:12px; text-decoration:underline;">🗑 入力内容を消去（この端末から）</a>';
  foot.parentNode.insertBefore(p, foot);
  document.getElementById('clearDraftBtn').addEventListener('click', e => {
    e.preventDefault();
    if (!confirm('この端末に自動保存された入力内容を消去します。よろしいですか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

// 下書きの有無に応じて消去リンクの表示を切り替える
function refreshClearControl() {
  const wrap = document.getElementById('clearDraftWrap');
  if (wrap) wrap.style.display = localStorage.getItem(STORAGE_KEY) ? 'block' : 'none';
}

// ─────── スパム対策：ハニーポット欄を注入 ───────
// 人には見えず、キーボードでも到達しない罠フィールド。
// bot が自動入力すると GAS 側で送信を無視する。全フォーム共通で1箇所に集約。
function injectHoneypot() {
  const form = document.getElementById('contactForm');
  if (!form || form.querySelector('input[name="website"]')) return;
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden;';
  wrap.innerHTML = '<label>Webサイト（このまま空欄にしてください）'
    + '<input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
  form.insertBefore(wrap, form.firstChild);
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
    const on = selected.includes(cat);
    card.classList.toggle('active', on);
    // 未選択（非表示）カードの入力は送信に含めない＝クリアする（幽霊データ防止）
    if (!on) clearInputsIn(card);
  });
}

// 指定コンテナ内の入力値をすべてクリア
function clearInputsIn(container) {
  container.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
      const chip = el.closest('.chip') || el.closest('.bigchip');
      if (chip) chip.classList.remove('checked');
    } else {
      el.value = '';
    }
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
    refreshClearControl();
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
    if (Date.now() - (data.savedAt || 0) > 3 * 24 * 60 * 60 * 1000) {
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
  // 送信前チェック：メール形式（入力があるときだけ検証。任意項目なので空はOK）
  const emailEl = document.getElementById('email');
  if (emailEl && emailEl.value.trim() && !emailEl.checkValidity()) {
    const stepEl = emailEl.closest('.step');
    if (stepEl) showStep(Number(stepEl.getAttribute('data-step')));
    alert('メールアドレスの形式をご確認ください。\n（例：example@xxx.com）\n\n分からなければ空欄のままでも送信できます。');
    emailEl.focus();
    return;
  }
  // 未選択カテゴリの詳細入力を送信対象から除外（幽霊データ防止）
  refreshDetailCards();

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
    refreshClearControl();
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
