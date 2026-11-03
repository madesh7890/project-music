/**
 * MUSIC Auth System — auth.js
 * Handles: Login, Register, Session persistence
 */

const AUTH_KEY = 'music_auth_session';

// ─────────────────────────────────────────
// Session Helpers
// ─────────────────────────────────────────
function saveSession(user, token) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token, ts: Date.now() }));
}

function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

// ─────────────────────────────────────────
// Already logged in → redirect to app
// ─────────────────────────────────────────
(function checkAlreadyLoggedIn() {
  const session = getSession();
  if (session && session.user && session.token) {
    // Valid session exists → go to main app
    window.location.replace('/index.html');
  }
})();

// ─────────────────────────────────────────
// DOM Elements
// ─────────────────────────────────────────
const tabLogin       = document.getElementById('tabLogin');
const tabRegister    = document.getElementById('tabRegister');
const loginForm      = document.getElementById('loginForm');
const registerForm   = document.getElementById('registerForm');
const authSuccess    = document.getElementById('authSuccess');
const successMessage = document.getElementById('successMessage');

const loginIdentifier = document.getElementById('loginIdentifier');
const loginPassword   = document.getElementById('loginPassword');
const loginError      = document.getElementById('loginError');
const loginSubmitBtn  = document.getElementById('loginSubmitBtn');

const regEmail           = document.getElementById('regEmail');
const regUsername        = document.getElementById('regUsername');
const regPassword        = document.getElementById('regPassword');
const regConfirmPassword = document.getElementById('regConfirmPassword');
const registerError      = document.getElementById('registerError');
const registerSubmitBtn  = document.getElementById('registerSubmitBtn');
const strengthBar        = document.getElementById('strengthBar');
const strengthLabel      = document.getElementById('strengthLabel');
const confirmMatchHint   = document.getElementById('confirmMatchHint');

// ─────────────────────────────────────────
// Tab Switching
// ─────────────────────────────────────────
function showTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    clearError(loginError);
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
    clearError(registerError);
  }
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));
document.getElementById('goToRegister').addEventListener('click', () => showTab('register'));
document.getElementById('goToLogin').addEventListener('click', () => showTab('login'));

// ─────────────────────────────────────────
// Error Display
// ─────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
  el.style.animation = 'none';
  setTimeout(() => { el.style.animation = ''; }, 10);
}

function clearError(el) {
  el.textContent = '';
  el.classList.remove('show');
}

// ─────────────────────────────────────────
// Loading state
// ─────────────────────────────────────────
function setLoading(btn, loading) {
  const txtEl = btn.querySelector('.btn-text');
  const ldrEl = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  txtEl.style.display = loading ? 'none' : 'inline';
  ldrEl.style.display = loading ? 'inline-flex' : 'none';
}

// ─────────────────────────────────────────
// Show/Hide Password Toggle
// ─────────────────────────────────────────
document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');
    if (input.type === 'password') {
      input.type = 'text';
      eyeOpen.style.display = 'none';
      eyeClosed.style.display = 'block';
    } else {
      input.type = 'password';
      eyeOpen.style.display = 'block';
      eyeClosed.style.display = 'none';
    }
  });
});

// ─────────────────────────────────────────
// Password Strength Meter
// ─────────────────────────────────────────
regPassword.addEventListener('input', () => {
  const val = regPassword.value;
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: 0,   color: 'transparent', label: '',              labelColor: '' },
    { pct: 20,  color: '#f15e6c',     label: 'Very Weak',     labelColor: '#f15e6c' },
    { pct: 40,  color: '#f97316',     label: 'Weak',          labelColor: '#f97316' },
    { pct: 60,  color: '#eab308',     label: 'Fair',          labelColor: '#eab308' },
    { pct: 80,  color: '#84cc16',     label: 'Strong',        labelColor: '#84cc16' },
    { pct: 100, color: '#1ed760',     label: '💪 Very Strong', labelColor: '#1ed760' },
  ];
  const lv = levels[score] || levels[0];
  strengthBar.style.width = lv.pct + '%';
  strengthBar.style.background = lv.color;
  strengthLabel.textContent = lv.label;
  strengthLabel.style.color = lv.labelColor;
  checkConfirmMatch();
});

// ─────────────────────────────────────────
// Confirm Password Match Check
// ─────────────────────────────────────────
function checkConfirmMatch() {
  const pass = regPassword.value;
  const conf = regConfirmPassword.value;
  if (!conf) { confirmMatchHint.style.display = 'none'; return; }
  confirmMatchHint.style.display = 'block';
  if (pass === conf) {
    confirmMatchHint.textContent = '✅ Passwords match!';
    confirmMatchHint.className = 'input-hint match-ok';
  } else {
    confirmMatchHint.textContent = '❌ Passwords do not match';
    confirmMatchHint.className = 'input-hint match-fail';
  }
}

regConfirmPassword.addEventListener('input', checkConfirmMatch);

// ─────────────────────────────────────────
// Success Screen
// ─────────────────────────────────────────
function showSuccessScreen(username, isNew) {
  loginForm.style.display = 'none';
  registerForm.style.display = 'none';
  authSuccess.style.display = 'flex';
  successMessage.textContent = isNew
    ? `Account created! Welcome, ${username} 🎶`
    : `Welcome back, ${username}! 🎵`;

  // Redirect after progress bar fills (1.6s)
  setTimeout(() => {
    window.location.replace('/index.html');
  }, 1700);
}

// ─────────────────────────────────────────
// LOGIN Submit
// ─────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginError);

  const identifier = loginIdentifier.value.trim();
  const password   = loginPassword.value;

  if (!identifier || !password) {
    showError(loginError, 'Please fill in all fields.');
    return;
  }

  setLoading(loginSubmitBtn, true);
  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    setLoading(loginSubmitBtn, false);

    if (data.success) {
      saveSession(data.user, data.token);
      showSuccessScreen(data.user.username, false);
    } else {
      showError(loginError, data.error || 'Login failed. Please try again.');
      loginPassword.value = '';
    }
  } catch (err) {
    setLoading(loginSubmitBtn, false);
    showError(loginError, 'Connection error. Please make sure the app is running.');
  }
});

// ─────────────────────────────────────────
// REGISTER Submit
// ─────────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(registerError);

  const email    = regEmail.value.trim();
  const username = regUsername.value.trim();
  const password = regPassword.value;
  const confirm  = regConfirmPassword.value;

  if (!email || !username || !password || !confirm) {
    showError(registerError, 'Please fill in all fields.');
    return;
  }
  if (password !== confirm) {
    showError(registerError, 'Passwords do not match. Please re-enter.');
    return;
  }
  if (password.length < 6) {
    showError(registerError, 'Password must be at least 6 characters.');
    return;
  }

  setLoading(registerSubmitBtn, true);
  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    });
    const data = await res.json();
    setLoading(registerSubmitBtn, false);

    if (data.success) {
      saveSession(data.user, data.token);
      showSuccessScreen(data.user.username, true);
    } else {
      showError(registerError, data.error || 'Registration failed. Please try again.');
    }
  } catch (err) {
    setLoading(registerSubmitBtn, false);
    showError(registerError, 'Connection error. Please make sure the app is running.');
  }
});

// ─────────────────────────────────────────
// Focus first input on load
// ─────────────────────────────────────────
setTimeout(() => {
  if (loginIdentifier) loginIdentifier.focus();
}, 200);
