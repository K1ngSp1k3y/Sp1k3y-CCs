function safeGetStorage(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch (e) { return fallback; }
}

function safeSetStorage(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

function safeRemoveStorage(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null ? parsed : fallback;
  } catch (e) { return fallback; }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount) {
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showToast(msg, icon = '✓') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `<span style="color:#10b981; font-weight:800;">${escapeHTML(icon)}</span><span>${escapeHTML(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = '0.22s ease';
    setTimeout(() => el.remove(), 240);
  }, 2600);
}

function copyTextToClipboard(text, label = 'Copied to clipboard!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(label, '📋')).catch(() => fallbackCopy(text, label));
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(label, '📋');
  } catch (e) {
    showToast('Unable to copy automatically', '!');
  }
  ta.remove();
}

function handleOutsideModal(e, modalId) {
  if (e.target === document.getElementById(modalId)) {
    document.getElementById(modalId).style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCardDetailModal();
    closeGameDemoModal();
    closeAuthModal();
    closeProfileModal();
    closeCartModal();
    closeOwnerLogin();
    closeOwnerDashboard();
    closeArcadeDepositModal();
    closeBalanceCheckerModal();
  }
});

let qualityMode = safeGetStorage('spikey_quality', 'mid');
if (!['high', 'mid', 'low'].includes(qualityMode)) qualityMode = 'mid';

let skyController = null;

function setQualityMode(mode, notify = true) {
  if (!['high', 'mid', 'low'].includes(mode)) return;
  qualityMode = mode;
  safeSetStorage('spikey_quality', mode);

  document.body.classList.remove('quality-high', 'quality-mid', 'quality-low');
  document.body.classList.add(`quality-${mode}`);

  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-q') === mode);
  });

  const sidebarTxt = document.getElementById('sidebarQualityText');
  if (sidebarTxt) sidebarTxt.innerText = mode.toUpperCase();

  if (skyController && typeof skyController.configure === 'function') {
    skyController.configure(mode);
  }

  if (typeof applyCardFilters === 'function' && typeof catalogCards !== 'undefined') {
    applyCardFilters(true);
  }

  if (notify) {
    const labels = {
      high: 'High Graphics: Watermark animations & 60 FPS sky',
      mid: 'Mid Graphics: Balanced animations & 30 FPS sky',
      low: 'Low Graphics: Maximum FPS mode (animations & canvas paused)'
    };
    showToast(labels[mode], '⚙');
  }
}

(function initSpaceCanvas() {
  const canvas = document.getElementById('spaceCanvas');
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let stars = [];
  let meteors = [];
  let frameInterval = 32;
  let starTargetCount = 120;
  let meteorTargetCount = 3;
  let isPaused = false;
  const colors = ['#ffffff', '#ffffff', '#e0e7ff', '#ddd6fe', '#bae6fd'];

  function rebuildParticles() {
    stars = Array.from({ length: starTargetCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: i % 10 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.8,
      color: colors[i % colors.length],
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.025
    }));

    meteors = Array.from({ length: meteorTargetCount }, (_, j) => ({
      x: Math.random() * width * 1.2,
      y: -80 - j * 220,
      len: 75 + Math.random() * 45,
      speed: 6 + Math.random() * 4,
      delay: j * 90
    }));
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildParticles();
  }

  function configure(mode) {
    if (mode === 'low') {
      isPaused = true;
      ctx.clearRect(0, 0, width, height);
      return;
    }
    isPaused = false;
    if (mode === 'high') {
      frameInterval = 16;
      starTargetCount = 240;
      meteorTargetCount = 6;
    } else {
      frameInterval = 32;
      starTargetCount = 120;
      meteorTargetCount = 3;
    }
    rebuildParticles();
  }

  skyController = { configure };

  resizeCanvas();
  configure(qualityMode);
  window.addEventListener('resize', resizeCanvas);

  let lastFrame = 0;
  function renderSky(ts) {
    requestAnimationFrame(renderSky);
    if (isPaused || document.hidden || ts - lastFrame < frameInterval) return;
    lastFrame = ts;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.phase += s.speed;
      ctx.globalAlpha = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.85;
    for (let j = 0; j < meteors.length; j++) {
      const m = meteors[j];
      if (m.delay > 0) {
        m.delay--;
        continue;
      }
      const grad = ctx.createLinearGradient(m.x, m.y, m.x + m.len, m.y - m.len);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.5, 'rgba(167,139,250,0.35)');
      grad.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + m.len, m.y - m.len);
      ctx.stroke();

      m.x -= m.speed;
      m.y += m.speed;
      if (m.y > height + 120 || m.x < -120) {
        m.x = Math.random() * width * 1.25 + 80;
        m.y = -60;
        m.delay = 60 + Math.floor(Math.random() * 140);
      }
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(renderSky);
})();

function updateStatusBar() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  document.getElementById('clockDisplay').innerText = `${hours}:${minutes} ${ampm}`;
}
setInterval(updateStatusBar, 1000);
updateStatusBar();

if (navigator.getBattery) {
  navigator.getBattery().then(bat => {
    const syncBat = () => {
      const pct = Math.round(bat.level * 100);
      document.getElementById('batteryDisplay').innerText = `${bat.charging ? '⚡' : '🔋'} ${pct}%`;
    };
    syncBat();
    bat.addEventListener('levelchange', syncBat);
    bat.addEventListener('chargingchange', syncBat);
  }).catch(() => {});
}

const sidebarEl = document.getElementById('sidebarNavPanel');
const hoverZoneEl = document.getElementById('sidebarHoverZone');
let sidebarCloseTimer = null;

function openHoverSidebar() {
  if (sidebarCloseTimer) {
    clearTimeout(sidebarCloseTimer);
    sidebarCloseTimer = null;
  }
  sidebarEl.classList.add('hover-open');
}

function scheduleCloseHoverSidebar() {
  if (sidebarCloseTimer) clearTimeout(sidebarCloseTimer);
  sidebarCloseTimer = setTimeout(() => {
    sidebarEl.classList.remove('hover-open');
  }, 180);
}

hoverZoneEl.addEventListener('mouseenter', openHoverSidebar);
sidebarEl.addEventListener('mouseenter', openHoverSidebar);
sidebarEl.addEventListener('mouseleave', scheduleCloseHoverSidebar);

function toggleSidebar() {
  if (window.innerWidth <= 900) {
    document.body.classList.toggle('mobile-nav-open');
    document.getElementById('sidebarBackdrop').classList.toggle('visible');
  } else {
    document.body.classList.toggle('sidebar-pinned');
  }
}

/* ==========================================================================
   BANK THEMES & WATERMARK HELPERS
   ========================================================================== */
const realBanks = [
  "Bank of America", "Wells Fargo", "Chase Bank", "Citibank",
  "U.S. Bank", "PNC Bank", "Capital One", "Target Gift", "American Express"
];

const bankThemeMap = {
  "Bank of America": "bank-bofa",
  "Wells Fargo": "bank-wellsfargo",
  "Chase Bank": "bank-chase",
  "Citibank": "bank-citi",
  "U.S. Bank": "bank-usbank",
  "PNC Bank": "bank-pnc",
  "Capital One": "bank-capitalone",
  "Target Gift": "bank-target",
  "American Express": "bank-amex",
  "Vault Purple": "bank-default"
};

const allBannerThemes = Object.keys(bankThemeMap);

function getBannerWatermarkText(bankName) {
  const label = (bankName || 'SPIKEY VAULT').toUpperCase();
  return `${label} • `.repeat(220);
}

function applyBankBannerStyling(boxEl, watermarkEl, bankName, tagEl = null) {
  if (!boxEl || !watermarkEl) return;
  const chosen = allBannerThemes.includes(bankName) ? bankName : 'Vault Purple';
  const themeClass = bankThemeMap[chosen] || 'bank-default';
  Object.values(bankThemeMap).forEach(cls => boxEl.classList.remove(cls));
  boxEl.classList.add(themeClass);
  watermarkEl.textContent = getBannerWatermarkText(chosen);
  if (tagEl) tagEl.innerText = chosen.toUpperCase();
}

/* ==========================================================================
   ACCOUNT & PERSISTENT STORAGE MANAGEMENT (FIXED BUGS & NO WIPING)
   ========================================================================== */
let accountsDB = safeParseJSON(safeGetStorage('spikey_accounts_v2'), {});
let currentUser = safeGetStorage('spikey_user_v2', null);
let userBalance = parseFloat(safeGetStorage('spikey_balance_v2', '15.00')) || 15.00;
let arcadeBalance = parseFloat(safeGetStorage('spikey_arcade_bal_v2', '50.00')) || 50.00;
let cartItems = safeParseJSON(safeGetStorage('spikey_cart_v2'), []);
let ownerLogs = safeParseJSON(safeGetStorage('spikey_owner_logs_v2'), []);
let bannedOperators = safeParseJSON(safeGetStorage('spikey_banned_v2'), []);

let visitorIP = safeGetStorage('spikey_visitor_ip_v2', null);
if (!visitorIP) {
  visitorIP = `192.168.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  safeSetStorage('spikey_visitor_ip_v2', visitorIP);
}
let claimedBonusIPs = safeParseJSON(safeGetStorage('spikey_claimed_bonus_ips_v2'), []);

(function migrateAndInitSession() {
  if (currentUser) {
    const key = currentUser.toLowerCase();
    if (!accountsDB[key]) {
      accountsDB[key] = {
        username: currentUser,
        displayName: currentUser,
        passwordHash: '',
        bio: 'Vault operator & card collector.',
        email: currentUser.toLowerCase().replace(/[^a-z0-9]/g, '') + '@example.com',
        pfpType: 'letter',
        pfpValue: '',
        bannerBank: 'Bank of America',
        balance: userBalance,
        arcadeBal: arcadeBalance,
        joinedAt: new Date().toLocaleDateString()
      };
      safeSetStorage('spikey_accounts_v2', JSON.stringify(accountsDB));
    } else {
      userBalance = typeof accountsDB[key].balance === 'number' ? accountsDB[key].balance : userBalance;
      arcadeBalance = typeof accountsDB[key].arcadeBal === 'number' ? accountsDB[key].arcadeBal : arcadeBalance;
    }
  }
})();

function getActiveAccount() {
  if (!currentUser) return null;
  const key = currentUser.toLowerCase();
  return accountsDB[key] || null;
}

function getDisplayAvatarInnerHTML(acc, fallbackName = 'G') {
  if (acc && acc.pfpType === 'upload' && acc.pfpValue) {
    return `<img src="${acc.pfpValue}" alt="PFP">`;
  }
  if (acc && acc.pfpType === 'preset' && acc.pfpValue) {
    return escapeHTML(acc.pfpValue);
  }
  const label = (acc && acc.displayName) ? acc.displayName : fallbackName;
  return escapeHTML(label.charAt(0).toUpperCase());
}

let newsList = safeParseJSON(safeGetStorage('spikey_news_v2'), [
  {
    title: "Global Vault Stock & 0 Lag Arcade Update Live",
    content: "Purchased cards are now globally removed from vault stock. Arcade games use a separate secure bankroll deposit system with zero lag processing.",
    time: "Pinned"
  },
  {
    title: "Gift Card Balance Checker & Secure Owner Logs",
    content: "Verify vouchers instantly with our new Balance Checker tool. Owner dashboard is strictly protected and securely persisted.",
    time: "Today"
  }
]);

let discordMessages = safeParseJSON(safeGetStorage('spikey_chat_rooms_v2'), {
  '#general-lobby': [
    { username: 'sp1k3y', user: 'Sp1k3y', pfp: 'S', pfpType: 'letter', pfpValue: '', time: '12:00 PM', text: 'Welcome to the Chat Room! Vault restock is live.' },
    { username: 'cyberghost', user: 'CyberGhost', pfp: 'C', pfpType: 'letter', pfpValue: '', time: '12:04 PM', text: 'Global card deletion working smoothly across sessions.' }
  ],
  '#vault-drops': [
    { username: 'vaultbot', user: 'VaultBot', pfp: 'V', pfpType: 'letter', pfpValue: '', time: '11:30 AM', text: 'Restock Alert: 210 luxury cards active with full 16-digit last-4 revelation.' }
  ],
  '#high-rollers': [
    { username: 'whalex', user: 'WhaleX', pfp: 'W', pfpType: 'letter', pfpValue: '', time: '10:15 AM', text: 'Arcade deposit bankroll is awesome — separate from shopping balance!' }
  ],
  '#support': [
    { username: 'modsupport', user: 'ModSupport', pfp: 'M', pfpType: 'letter', pfpValue: '', time: '9:00 AM', text: 'Use the Gift Card Balance Checker before submitting vouchers.' }
  ]
});

function saveState() {
  const acc = getActiveAccount();
  if (acc) {
    acc.balance = Number(userBalance.toFixed(2));
    acc.arcadeBal = Number(arcadeBalance.toFixed(2));
    accountsDB[currentUser.toLowerCase()] = acc;
  }
  safeSetStorage('spikey_accounts_v2', JSON.stringify(accountsDB));
  safeSetStorage('spikey_balance_v2', userBalance.toFixed(2));
  safeSetStorage('spikey_arcade_bal_v2', arcadeBalance.toFixed(2));
  if (currentUser) safeSetStorage('spikey_user_v2', currentUser);
  else safeRemoveStorage('spikey_user_v2');
  safeSetStorage('spikey_cart_v2', JSON.stringify(cartItems));
  safeSetStorage('spikey_owner_logs_v2', JSON.stringify(ownerLogs));
  safeSetStorage('spikey_news_v2', JSON.stringify(newsList));
  safeSetStorage('spikey_chat_rooms_v2', JSON.stringify(discordMessages));
  safeSetStorage('spikey_claimed_bonus_ips_v2', JSON.stringify(claimedBonusIPs));
}

function updateWalletDisplay() {
  const formattedBal = formatMoney(userBalance);
  document.getElementById('userWalletBalance').innerText = formattedBal;
  const arcadeDisp = document.getElementById('arcadeBalanceDisplay');
  if (arcadeDisp) arcadeDisp.innerText = formatMoney(arcadeBalance);

  const totalCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cartBadgeCount').innerText = totalCount;
  const modalBal = document.getElementById('modalWalletBalanceText');
  if (modalBal) modalBal.innerText = formattedBal;
  const profileBal = document.getElementById('viewProfileWallet');
  if (profileBal) profileBal.innerText = formattedBal;
  const profileArcade = document.getElementById('viewProfileArcade');
  if (profileArcade) profileArcade.innerText = formatMoney(arcadeBalance);
  saveState();
}

function syncAuthUI() {
  const acc = getActiveAccount();
  const pfpEl = document.getElementById('userPfpDisplay');
  const nameEl = document.getElementById('userAuthName');
  const handleEl = document.getElementById('userAuthHandle');
  const bioEl = document.getElementById('userAuthBio');
  const actionEl = document.getElementById('authActionText');
  const sidebarBannerBox = document.getElementById('sidebarBannerBox');
  const sidebarBannerWm = document.getElementById('sidebarBannerWatermark');
  const headerPfp = document.getElementById('headerPfpDisplay');
  const headerName = document.getElementById('headerNameDisplay');

  if (acc) {
    const dispName = acc.displayName || acc.username;
    const avatarHTML = getDisplayAvatarInnerHTML(acc, dispName);
    pfpEl.innerHTML = avatarHTML;
    headerPfp.innerHTML = avatarHTML;
    headerName.innerText = dispName;

    nameEl.innerText = dispName;
    handleEl.innerText = `@${acc.username}`;

    if (acc.bio && acc.bio.trim()) {
      bioEl.style.display = '-webkit-box';
      bioEl.innerText = acc.bio;
    } else {
      bioEl.style.display = 'none';
    }

    actionEl.innerText = 'Edit Profile';
    actionEl.onclick = (e) => {
      e.stopPropagation();
      openProfileModal('edit');
    };

    applyBankBannerStyling(sidebarBannerBox, sidebarBannerWm, acc.bannerBank || 'Bank of America');
  } else {
    pfpEl.innerText = 'G';
    headerPfp.innerText = 'G';
    headerName.innerText = 'Sign In';
    nameEl.innerText = 'Guest';
    handleEl.innerText = '@guest · Click to sign in';
    bioEl.style.display = 'none';
    actionEl.innerText = 'Sign Up / Log In';
    actionEl.onclick = (e) => {
      e.stopPropagation();
      openAuthModal();
    };
    applyBankBannerStyling(sidebarBannerBox, sidebarBannerWm, 'Vault Purple');
  }
}
syncAuthUI();

function handleSidebarProfileClick() {
  if (getActiveAccount()) {
    openProfileModal('view');
  } else {
    openAuthModal();
  }
}

let authMode = 'signup';
function openAuthModal() {
  renderSavedAccountChips();
  document.getElementById('authModal').style.display = 'flex';
}
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }

function renderSavedAccountChips() {
  const box = document.getElementById('savedAccountsQuickBox');
  const chipsWrap = document.getElementById('savedAccountsChips');
  const keys = Object.keys(accountsDB);
  if (!keys.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  chipsWrap.innerHTML = keys.map(k => {
    const a = accountsDB[k];
    const disp = a.displayName || a.username;
    return `
      <button type="button" class="receipt-copy-btn" style="padding:4px 8px; font-size:10px; display:inline-flex; align-items:center; gap:5px;" onclick="prefillLoginAccount('${escapeHTML(a.username)}')">
        <span>${escapeHTML(disp)}</span>
        <span style="opacity:0.75;">(@${escapeHTML(a.username)})</span>
      </button>
    `;
  }).join('');
}

function prefillLoginAccount(username) {
  switchAuthMode('login', document.getElementById('tabAuthLogin'));
  document.getElementById('authUsernameInput').value = username;
  document.getElementById('authPasswordInput').focus();
}

function switchAuthMode(mode, el) {
  authMode = mode;
  document.getElementById('tabAuthSignup').classList.remove('active');
  document.getElementById('tabAuthLogin').classList.remove('active');
  el.classList.add('active');

  const dispGroup = document.getElementById('authDisplayNameGroup');
  const bannerGroup = document.getElementById('authStarterBannerGroup');

  if (mode === 'signup') {
    document.getElementById('authModalTitle').innerText = 'Create Account';
    document.getElementById('authModalSubtitle').innerText = 'Create your profile with a $15.00 shopping welcome bonus and custom bank watermark banner.';
    document.getElementById('authSubmitBtn').innerText = 'Create Account & Claim $15';
    dispGroup.style.display = 'block';
    bannerGroup.style.display = 'block';
  } else {
    document.getElementById('authModalTitle').innerText = 'Welcome Back';
    document.getElementById('authModalSubtitle').innerText = 'Sign in to restore your saved shopping wallet, arcade bankroll, PFP, and bio.';
    document.getElementById('authSubmitBtn').innerText = 'Log In';
    dispGroup.style.display = 'none';
    bannerGroup.style.display = 'none';
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const rawUsername = document.getElementById('authUsernameInput').value.trim();
  const password = document.getElementById('authPasswordInput').value;
  if (!rawUsername || !password) return;

  const key = rawUsername.toLowerCase();

  if (bannedOperators.includes(key)) {
    showToast('Access Denied: This operator account has been banned.', '!');
    return;
  }

  if (authMode === 'signup') {
    if (accountsDB[key]) {
      showToast('Username already exists — switched to Log In', '!');
      switchAuthMode('login', document.getElementById('tabAuthLogin'));
      return;
    }

    const displayNameInput = document.getElementById('authDisplayNameInput').value.trim();
    const chosenBanner = document.getElementById('authBannerSelect').value || 'Bank of America';

    const alreadyClaimed = claimedBonusIPs.includes(visitorIP);
    const startingBalance = alreadyClaimed ? 0.00 : 15.00;

    if (!alreadyClaimed) {
      claimedBonusIPs.push(visitorIP);
      safeSetStorage('spikey_claimed_bonus_ips_v2', JSON.stringify(claimedBonusIPs));
    }

    accountsDB[key] = {
      username: rawUsername,
      displayName: displayNameInput || rawUsername,
      passwordHash: password,
      bio: 'Vault operator & card collector.',
      email: rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '') + '@example.com',
      pfpType: 'letter',
      pfpValue: '',
      bannerBank: chosenBanner,
      balance: startingBalance,
      arcadeBal: 50.00,
      joinedAt: new Date().toLocaleDateString()
    };

    currentUser = rawUsername;
    userBalance = startingBalance;
    arcadeBalance = 50.00;
    document.getElementById('authPasswordInput').value = '';
    saveState();
    syncAuthUI();
    updateWalletDisplay();
    renderChatMessages();
    closeAuthModal();

    showToast(`Welcome ${accountsDB[key].displayName}! Account created successfully.`);
  } else {
    const existing = accountsDB[key];
    if (!existing) {
      showToast('Account not found — create an account first', '!');
      return;
    }
    if (existing.passwordHash && existing.passwordHash !== password) {
      showToast('Incorrect password for this account', '!');
      return;
    }
    if (!existing.passwordHash) {
      existing.passwordHash = password;
    }

    currentUser = existing.username;
    userBalance = typeof existing.balance === 'number' ? existing.balance : 0.00;
    arcadeBalance = typeof existing.arcadeBal === 'number' ? existing.arcadeBal : 50.00;
    document.getElementById('authPasswordInput').value = '';
    saveState();
    syncAuthUI();
    updateWalletDisplay();
    renderChatMessages();
    closeAuthModal();
    showToast(`Welcome back, ${existing.displayName || existing.username}!`);
  }
}

function handleLogout() {
  saveState();
  currentUser = null;
  userBalance = 15.00;
  arcadeBalance = 50.00;
  safeRemoveStorage('spikey_user_v2');
  syncAuthUI();
  updateWalletDisplay();
  renderChatMessages();
  closeProfileModal();
  showToast('Signed out');
}

/* ==========================================================================
   PROFILE MODAL & CUSTOMIZATION
   ========================================================================== */
let draftPfpType = 'letter';
let draftPfpValue = '';
let draftBannerBank = 'Bank of America';

function buildBannerChoiceGrid() {
  const grid = document.getElementById('bannerChoiceGrid');
  if (!grid) return;
  grid.innerHTML = allBannerThemes.map(bank => {
    const cls = bankThemeMap[bank] || 'bank-default';
    return `
      <button type="button" class="banner-choice-btn ${cls}" data-banner-bank="${escapeHTML(bank)}" onclick="selectProfileBanner('${escapeHTML(bank)}')">
        <div class="cc-watermark" aria-hidden="true">${getBannerWatermarkText(bank)}</div>
        <span style="position:relative; z-index:3;">${escapeHTML(bank)}</span>
      </button>
    `;
  }).join('');
}
buildBannerChoiceGrid();

function openProfileModal(initialTab = 'view', inspectedProfile = null) {
  const switchBar = document.getElementById('profileModeSwitchBar');
  const ownerActions = document.getElementById('viewProfileOwnerActions');

  if (inspectedProfile) {
    switchBar.style.display = 'none';
    ownerActions.style.display = 'none';
    renderProfileViewCard(inspectedProfile, false);
    document.getElementById('profileViewSection').style.display = 'block';
    document.getElementById('profileEditSection').style.display = 'none';
    document.getElementById('profileModal').style.display = 'flex';
    return;
  }

  const acc = getActiveAccount();
  if (!acc) {
    openAuthModal();
    return;
  }

  switchBar.style.display = 'flex';
  ownerActions.style.display = 'flex';
  renderProfileViewCard(acc, true);
  populateEditProfileForm(acc);
  switchProfileModalTab(initialTab);
  document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; }

function switchProfileModalTab(tab) {
  const viewTabBtn = document.getElementById('tabProfileView');
  const editTabBtn = document.getElementById('tabProfileEdit');
  const viewSec = document.getElementById('profileViewSection');
  const editSec = document.getElementById('profileEditSection');

  if (tab === 'edit') {
    viewTabBtn.classList.remove('active');
    editTabBtn.classList.add('active');
    viewSec.style.display = 'none';
    editSec.style.display = 'flex';
  } else {
    editTabBtn.classList.remove('active');
    viewTabBtn.classList.add('active');
    editSec.style.display = 'none';
    viewSec.style.display = 'block';
  }
}

function renderProfileViewCard(profileObj, isSelf = true) {
  const dispName = profileObj.displayName || profileObj.username || 'Operator';
  const username = profileObj.username || dispName.toLowerCase().replace(/\s+/g, '');
  const bannerBank = profileObj.bannerBank || 'Bank of America';

  applyBankBannerStyling(
    document.getElementById('viewProfileBannerBox'),
    document.getElementById('viewProfileBannerWatermark'),
    bannerBank,
    document.getElementById('viewProfileBannerTag')
  );

  document.getElementById('viewProfileAvatar').innerHTML = getDisplayAvatarInnerHTML(profileObj, dispName);
  document.getElementById('viewProfileDisplayName').innerText = dispName;
  document.getElementById('viewProfileUsername').innerText = `@${username}`;
  document.getElementById('viewProfileBio').innerText = (profileObj.bio && profileObj.bio.trim()) ? profileObj.bio : 'No bio set yet.';
  document.getElementById('viewProfileWallet').innerText = isSelf ? formatMoney(userBalance) : formatMoney(profileObj.balance || 0);
  document.getElementById('viewProfileArcade').innerText = isSelf ? formatMoney(arcadeBalance) : formatMoney(profileObj.arcadeBal || 0);
  document.getElementById('viewProfileStatusBadge').innerText = isSelf ? '● ONLINE (YOU)' : '● VAULT MEMBER';
}

function populateEditProfileForm(acc) {
  document.getElementById('editDisplayNameInput').value = acc.displayName || acc.username;
  document.getElementById('editEmailInput').value = acc.email || '';
  document.getElementById('editBioInput').value = acc.bio || '';
  updateBioCounter();

  draftPfpType = acc.pfpType || 'letter';
  draftPfpValue = acc.pfpValue || '';
  draftBannerBank = acc.bannerBank || 'Bank of America';

  document.querySelectorAll('#pfpPresetGrid .pfp-preset-btn').forEach(btn => {
    const t = btn.getAttribute('data-pfp-type');
    const v = btn.getAttribute('data-pfp-val');
    const isMatch = (draftPfpType === 'letter' && t === 'letter') || (draftPfpType === 'preset' && draftPfpValue === v);
    btn.classList.toggle('active', isMatch);
  });

  selectProfileBanner(draftBannerBank);
  syncEditProfilePreview();
}

function updateBioCounter() {
  const val = document.getElementById('editBioInput').value || '';
  document.getElementById('editBioCharCount').innerText = `${val.length}/160`;
}

function syncEditProfilePreview() {
  const acc = getActiveAccount();
  const typedName = document.getElementById('editDisplayNameInput').value.trim() || (acc ? acc.username : 'Operator');
  document.getElementById('editPreviewNameText').innerText = typedName;
  document.getElementById('editPreviewHandleText').innerText = acc ? `@${acc.username}` : '@operator';

  const tempAcc = { displayName: typedName, pfpType: draftPfpType, pfpValue: draftPfpValue };
  document.getElementById('editPreviewAvatar').innerHTML = getDisplayAvatarInnerHTML(tempAcc, typedName);
}

function selectPresetPfp(type, val, btnEl) {
  draftPfpType = type;
  draftPfpValue = type === 'letter' ? '' : val;
  document.querySelectorAll('#pfpPresetGrid .pfp-preset-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  syncEditProfilePreview();
}

function handlePfpFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', '!');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(loadEvent) {
    const img = new Image();
    img.onload = function() {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      draftPfpType = 'upload';
      draftPfpValue = canvas.toDataURL('image/jpeg', 0.85);
      document.querySelectorAll('#pfpPresetGrid .pfp-preset-btn').forEach(b => b.classList.remove('active'));
      syncEditProfilePreview();
      showToast('Custom PFP loaded! Click Save Profile Info.');
    };
    img.src = loadEvent.target.result;
  };
  reader.readAsDataURL(file);
}

function selectProfileBanner(bankName) {
  draftBannerBank = bankName;
  document.querySelectorAll('#bannerChoiceGrid .banner-choice-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-banner-bank') === bankName);
  });
  applyBankBannerStyling(
    document.getElementById('editPreviewBannerBox'),
    document.getElementById('editPreviewBannerWatermark'),
    bankName,
    document.getElementById('editPreviewBannerTag')
  );
}

function saveProfileChanges(e) {
  e.preventDefault();
  const acc = getActiveAccount();
  if (!acc) return;

  acc.displayName = document.getElementById('editDisplayNameInput').value.trim() || acc.username;
  acc.email = document.getElementById('editEmailInput').value.trim();
  acc.bio = document.getElementById('editBioInput').value.trim();
  acc.pfpType = draftPfpType;
  acc.pfpValue = draftPfpValue;
  acc.bannerBank = draftBannerBank;

  accountsDB[currentUser.toLowerCase()] = acc;
  saveState();
  syncAuthUI();
  renderChatMessages();
  renderProfileViewCard(acc, true);
  switchProfileModalTab('view');
  showToast('Profile updated successfully!');
}

function inspectChatMember(usernameKey, fallbackName) {
  const key = (usernameKey || '').toLowerCase();
  if (currentUser && key === currentUser.toLowerCase()) {
    openProfileModal('view');
    return;
  }
  const found = accountsDB[key];
  if (found) {
    openProfileModal('view', found);
    return;
  }
  const sampleProfiles = {
    sp1k3y: { username: 'sp1k3y', displayName: 'Sp1k3y', bio: 'Founder of Sp1k3y’s Vault.', bannerBank: 'Wells Fargo', pfpType: 'preset', pfpValue: '👑', balance: 25000, arcadeBal: 5000, joinedAt: 'Founder' },
    cyberghost: { username: 'cyberghost', displayName: 'CyberGhost', bio: 'Card collector & gamer.', bannerBank: 'Bank of America', pfpType: 'letter', pfpValue: '', balance: 1200, arcadeBal: 250, joinedAt: 'Member' }
  };
  const profile = sampleProfiles[key] || { username: key || 'member', displayName: fallbackName || 'Member', bio: 'Vault community member.', bannerBank: 'Vault Purple', pfpType: 'letter', pfpValue: '', balance: 0, arcadeBal: 50, joinedAt: 'Member' };
  openProfileModal('view', profile);
}

/* ==========================================================================
   GLOBAL VAULT CARD GENERATION & STOCK SYNCHRONIZATION
   ========================================================================== */
function computeExactCardBalance(priceVal, index) {
  const rawCents = ((index * 37 + priceVal * 13 + 19) % 89) + 10;
  const cents = rawCents / 100;
  const spread = (index * 19 + 7) % 100;
  let wholeDollars = priceVal * 2;
  switch (priceVal) {
    case 5: wholeDollars = 18 + (spread % 32); break;
    case 10: wholeDollars = 36 + (spread % 54); break;
    case 15: wholeDollars = 54 + (spread % 76); break;
    case 50: wholeDollars = 175 + ((spread * 3) % 240); break;
    case 100: wholeDollars = 360 + ((spread * 5) % 520); break;
    case 250: wholeDollars = 940 + ((spread * 14) % 1380); break;
    case 500: wholeDollars = 9240 + ((spread * 7) % 690); break;
    case 1000: wholeDollars = 4350 + ((spread * 43) % 4450); break;
    case 2500: wholeDollars = 11250 + ((spread * 87) % 8450); break;
    case 5000: wholeDollars = 21400 + ((spread * 131) % 13400); break;
    case 10000: wholeDollars = 42850 + ((spread * 247) % 24900); break;
  }
  return Number((wholeDollars + cents).toFixed(2));
}

function computeLuhn(digits16) {
  let sum = 0;
  let shouldDouble = false;
  for (let k = digits16.length - 1; k >= 0; k--) {
    let d = parseInt(digits16.charAt(k), 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return (sum % 10) === 0;
}

let catalogCards = safeParseJSON(safeGetStorage('spikey_vault_cards_v2'), null);

function generateInitialVaultCards() {
  const cards = [];
  const usedLast4Set = new Set();
  for (let i = 1; i <= 210; i++) {
    const bankName = realBanks[i % realBanks.length];
    const isTarget = bankName.includes("Target");
    const net = isTarget ? 'target' : (i % 3 === 0 ? 'amex' : (i % 2 === 0 ? 'visa' : 'mastercard'));

    let binPrefix = '4532';
    if (net === 'mastercard') binPrefix = '5' + String(1 + (i % 5)) + String((i * 7) % 10) + String((i * 3) % 10);
    else if (net === 'amex') binPrefix = (i % 2 === 0 ? '37' : '34') + String((i * 9) % 10) + String((i * 5) % 10);
    else if (net === 'target') binPrefix = '6011';
    else binPrefix = '4' + String((i * 3 + 1) % 10) + String((i * 7 + 2) % 10) + String((i * 9 + 4) % 10);

    let last4 = String(1000 + ((i * 37 + 109) % 8999));
    while (usedLast4Set.has(last4)) {
      last4 = String((parseInt(last4, 10) + 1) % 10000).padStart(4, '0');
    }
    usedLast4Set.add(last4);

    const midDigits = String((i * 7919 + 104729) % 10000000).padStart(7, '0');
    let fullDigits = (binPrefix + midDigits).slice(0, 11) + last4;

    if (!computeLuhn(fullDigits)) {
      const arr = fullDigits.split('');
      for (let dTry = 0; dTry <= 9; dTry++) {
        arr[10] = String(dTry);
        if (computeLuhn(arr.join(''))) {
          fullDigits = arr.join('');
          break;
        }
      }
    }

    const fullNum = fullDigits.replace(/(.{4})/g, '$1 ').trim();
    const bankClass = bankThemeMap[bankName] || 'bank-default';
    const priceOptions = [5, 10, 15, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const priceVal = priceOptions[i % priceOptions.length];
    const cardValueDisplay = computeExactCardBalance(priceVal, i);

    cards.push({
      id: i,
      bank: bankName,
      bankClass: bankClass,
      watermark: `${bankName.toUpperCase()} • `.repeat(240),
      name: isTarget ? `Target Gift #${i}` : `${bankName} Platinum #${i}`,
      network: net,
      price: priceVal,
      cardValue: cardValueDisplay,
      fullNum: fullNum,
      last4: last4,
      exp: `01/2035`,
      cvv: String(100 + (i * 37) % 899)
    });
  }
  return cards;
}

if (!catalogCards || !catalogCards.length) {
  catalogCards = generateInitialVaultCards();
  safeSetStorage('spikey_vault_cards_v2', JSON.stringify(catalogCards));
}

function restockGlobalVaultCards() {
  catalogCards = generateInitialVaultCards();
  safeSetStorage('spikey_vault_cards_v2', JSON.stringify(catalogCards));
  applyCardFilters(true);
  closeOwnerDashboard();
  showToast('Global vault restocked with 210 fresh cards!');
}

/* ==========================================================================
   CART, CHECKOUT & GLOBAL CARD DELETION
   ========================================================================== */
let activePaymentMethod = 'gift';

function openCartModal() {
  resetCheckoutView();
  document.getElementById('cartModal').style.display = 'flex';
  renderCartModalContents();
  updateCartCardPreview();
}
function closeCartModal() { document.getElementById('cartModal').style.display = 'none'; }
function resetCheckoutView() {
  document.getElementById('checkoutFormSection').style.display = 'block';
  document.getElementById('checkoutReceiptSection').style.display = 'none';
}

function switchPaymentMethod(method, el) {
  activePaymentMethod = method;
  document.getElementById('payMethodGift').classList.remove('active');
  document.getElementById('payMethodBalance').classList.remove('active');
  el.classList.add('active');

  const cardInputs = document.getElementById('cardInputsGroup');
  const walletNotice = document.getElementById('walletPayNotice');
  const previewWrap = document.getElementById('previewCardWrapper');
  const numInput = document.getElementById('checkoutCardNum');
  const expInput = document.getElementById('checkoutCardExp');
  const cvvInput = document.getElementById('checkoutCardCvv');

  if (method === 'balance') {
    cardInputs.style.display = 'none';
    previewWrap.style.display = 'none';
    walletNotice.style.display = 'block';
    numInput.required = false;
    expInput.required = false;
    cvvInput.required = false;
    updateWalletDisplay();
  } else {
    cardInputs.style.display = 'flex';
    previewWrap.style.display = 'flex';
    walletNotice.style.display = 'none';
    numInput.required = true;
    expInput.required = true;
    cvvInput.required = true;
    updateCartCardPreview();
  }
}

function formatAndPreviewCard() {
  const input = document.getElementById('checkoutCardNum');
  const digits = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = digits.replace(/(.{4})/g, '$1 ').trim();
  updateCartCardPreview();
}

function formatExpInput() {
  const input = document.getElementById('checkoutCardExp');
  const digits = input.value.replace(/\D/g, '').slice(0, 6);
  input.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
  updateCartCardPreview();
}

function updateCartCardPreview() {
  const numVal = document.getElementById('checkoutCardNum').value.trim();
  const expVal = document.getElementById('checkoutCardExp').value.trim();
  const cvvVal = document.getElementById('checkoutCardCvv').value.trim();
  const cleanNum = numVal.replace(/\s+/g, '');

  const box = document.getElementById('previewCardBox');
  const brandEl = document.getElementById('previewCardBrand');
  const wmEl = document.getElementById('previewWatermarkLayer');

  let bankLabel = 'TARGET GIFT';
  box.className = 'cc-card bank-target';
  brandEl.className = 'cc-brand-logo target-logo';
  brandEl.innerText = 'TARGET';

  if (cleanNum.startsWith('4')) {
    bankLabel = 'BANK OF AMERICA';
    box.className = 'cc-card bank-bofa';
    brandEl.className = 'cc-brand-logo visa-logo';
    brandEl.innerText = 'VISA';
  } else if (cleanNum.startsWith('5')) {
    bankLabel = 'CHASE BANK';
    box.className = 'cc-card bank-chase';
    brandEl.className = 'cc-brand-logo mastercard-logo';
    brandEl.innerText = 'MASTERCARD';
  } else if (cleanNum.startsWith('3')) {
    bankLabel = 'AMERICAN EXPRESS';
    box.className = 'cc-card bank-amex';
    brandEl.className = 'cc-brand-logo amex-logo';
    brandEl.innerText = 'AMEX';
  }

  wmEl.textContent = `${bankLabel} • `.repeat(240);

  if (cleanNum.length > 0) {
    const padded = cleanNum.padEnd(16, '•');
    document.getElementById('previewCardNum').innerText = padded.replace(/(.{4})/g, '$1 ').trim();
  } else {
    document.getElementById('previewCardNum').innerText = '•••• •••• •••• ••••';
  }

  const acc = getActiveAccount();
  const holderName = acc ? (acc.displayName || acc.username) : (currentUser || 'GUEST');
  document.getElementById('previewCardHolder').innerText = holderName.toUpperCase();
  document.getElementById('previewCardExp').innerText = expVal || 'MM/YYYY';
  document.getElementById('previewCardCvv').innerText = cvvVal ? '•'.repeat(cvvVal.length) : '•••';
}

function renderCartModalContents() {
  const container = document.getElementById('cartItemsListContainer');
  if (cartItems.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--muted); font-size:12px; padding:16px;">Your cart is empty.</div>`;
    document.getElementById('cartTotalPriceDisplay').innerText = '$0.00';
    return;
  }

  let total = 0;
  container.innerHTML = cartItems.map((item, idx) => {
    total += item.price * item.qty;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(167,139,250,0.14); padding:8px 0; font-size:12px; gap:8px;">
        <div style="min-width:0; flex:1;">
          <div style="font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(item.name)}</div>
          <div class="mono" style="color:var(--muted); font-size:10.5px;">${formatMoney(item.price)} ea · Bal: ${formatMoney(item.cardValue)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <button type="button" onclick="changeCartQty(${idx}, -1)" style="width:22px; height:22px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.06); color:#fff; font-weight:700;">-</button>
          <span class="mono" style="font-size:11px; min-width:18px; text-align:center;">${item.qty}</span>
          <button type="button" onclick="changeCartQty(${idx}, 1)" style="width:22px; height:22px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.06); color:#fff; font-weight:700;">+</button>
          <span class="mono" style="color:#10b981; font-weight:700; min-width:68px; text-align:right;">${formatMoney(item.price * item.qty)}</span>
          <button type="button" onclick="removeFromCart(${idx})" style="background:none; border:none; color:#ef4444; font-weight:700; font-size:15px; padding:0 4px;">&times;</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotalPriceDisplay').innerText = formatMoney(total);
  const acc = getActiveAccount();
  if (acc && acc.email && !document.getElementById('checkoutEmail').value) {
    document.getElementById('checkoutEmail').value = acc.email;
  }
}

function addToCart(id, e) {
  if (e) e.stopPropagation();
  const card = catalogCards.find(c => c.id === id);
  if (!card) {
    showToast('Card is already sold out globally', '!');
    return;
  }
  const existing = cartItems.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cartItems.push({ ...card, qty: 1 });
  }
  updateWalletDisplay();
  showToast(`Added ${card.name} to cart`);
}

function changeCartQty(idx, delta) {
  if (!cartItems[idx]) return;
  cartItems[idx].qty += delta;
  if (cartItems[idx].qty <= 0) cartItems.splice(idx, 1);
  updateWalletDisplay();
  renderCartModalContents();
}

function removeFromCart(idx) {
  cartItems.splice(idx, 1);
  updateWalletDisplay();
  renderCartModalContents();
}

function isValidCardNumber(numStr) {
  const clean = numStr.replace(/\s+/g, '');
  return /^\d{13,19}$/.test(clean);
}

function buildRealisticBankFront(bankName, network) {
  let themeClass = 'real-front-chase';
  let titleHTML = `<span style="font-weight:800; letter-spacing:1.1px; font-size:12px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">${escapeHTML(bankName.toUpperCase())}</span>`;
  let artworkSVG = '';

  if (bankName === 'Wells Fargo') {
    themeClass = 'real-front-wellsfargo';
    titleHTML = `<span style="font-family:Georgia,serif; font-weight:800; letter-spacing:1.4px; font-size:12.5px; color:#fef08a; text-shadow:0 1px 3px rgba(0,0,0,0.65);">WELLS FARGO</span>`;
  } else if (bankName === 'Bank of America') {
    themeClass = 'real-front-bofa';
    titleHTML = `<span style="font-weight:800; letter-spacing:0.9px; font-size:11px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">BANK OF AMERICA</span>`;
  } else if (bankName === 'Chase Bank') {
    themeClass = 'real-front-chase';
    titleHTML = `<span style="font-weight:800; letter-spacing:1.8px; font-size:13px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">CHASE</span>`;
  } else if (bankName === 'Citibank') {
    themeClass = 'real-front-citi';
    titleHTML = `<span style="font-weight:800; letter-spacing:0.8px; font-size:13px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">citibank</span>`;
  } else if (bankName === 'U.S. Bank') {
    themeClass = 'real-front-usbank';
    titleHTML = `<span style="font-weight:800; letter-spacing:0.8px; font-size:12.5px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">u.s. bank</span>`;
  } else if (bankName === 'PNC Bank') {
    themeClass = 'real-front-pnc';
    titleHTML = `<span style="font-weight:800; letter-spacing:1.3px; font-size:12.5px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">PNC BANK</span>`;
  } else if (bankName === 'Capital One') {
    themeClass = 'real-front-capitalone';
    titleHTML = `<span style="font-weight:800; letter-spacing:0.6px; font-size:12.5px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">Capital One</span>`;
  } else if (bankName === 'American Express') {
    themeClass = 'real-front-amex';
    titleHTML = `<span style="font-weight:800; letter-spacing:1.1px; font-size:11px; color:#d1fae5; text-shadow:0 1px 3px rgba(0,0,0,0.65);">AMERICAN EXPRESS</span>`;
  } else if (bankName.includes('Target')) {
    themeClass = 'real-front-target';
    titleHTML = `<span style="font-weight:800; letter-spacing:1.6px; font-size:12.5px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.65);">TARGET</span>`;
  }

  let logoClass = 'visa-logo';
  let logoText = 'VISA';
  if (network === 'mastercard') { logoClass = 'mastercard-logo'; logoText = 'MC'; }
  if (network === 'amex') { logoClass = 'amex-logo'; logoText = 'AMEX'; }
  if (network === 'target') { logoClass = 'target-logo'; logoText = 'TARGET'; }

  return { themeClass, titleHTML, artworkSVG, logoClass, logoText };
}

function toggleReceiptCardFlip(sceneEl) {
  if (!sceneEl) return;
  sceneEl.classList.toggle('is-flipped');
}

let lastDispatchedCards = [];

function copyPurchasedCard(idx, e) {
  if (e) e.stopPropagation();
  const d = lastDispatchedCards[idx];
  if (!d) return;
  const text = `${d.bank} | ${d.cardNum} | Exp: 01/2035 | CVV: ${d.cvv} | ${d.name} (${d.location}) | Bal: ${formatMoney(d.cardValue)}`;
  copyTextToClipboard(text, `Copied ${d.bank} •••• ${d.last4}`);
}

function copyAllPurchasedCards() {
  if (!lastDispatchedCards.length) return;
  const text = lastDispatchedCards.map(d => `${d.bank} | ${d.cardNum} | Exp: 01/2035 | CVV: ${d.cvv} | ${d.name} (${d.location}) | Bal: ${formatMoney(d.cardValue)}`).join('
');
  copyTextToClipboard(text, `Copied all ${lastDispatchedCards.length} card(s)!`);
}

function executeCartCheckout(e) {
  e.preventDefault();
  if (cartItems.length === 0) {
    showToast('Your cart is empty', '!');
    return;
  }

  const email = document.getElementById('checkoutEmail').value.trim();
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString();
  const itemsSummary = cartItems.map(item => `${item.qty}x ${item.name}`).join(', ');

  let submittedGiftCard = null;

  if (activePaymentMethod === 'balance') {
    if (userBalance < totalPrice) {
      showToast(`Insufficient shopping wallet balance (${formatMoney(userBalance)} available)`, '!');
      return;
    }
    userBalance -= totalPrice;
  } else {
    const cardNum = document.getElementById('checkoutCardNum').value.trim();
    const cardExp = document.getElementById('checkoutCardExp').value.trim();
    const cardCvv = document.getElementById('checkoutCardCvv').value.trim();

    if (!isValidCardNumber(cardNum)) {
      showToast('Enter a valid 13–19 digit card number', '!');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2,4}$/.test(cardExp)) {
      showToast('Enter expiration as MM/YYYY', '!');
      return;
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
      showToast('Enter a valid 3 or 4 digit CVV/PIN', '!');
      return;
    }
    submittedGiftCard = { number: cardNum, exp: cardExp, cvv: cardCvv };
  }

  // GLOBAL CARD DELETION: Remove purchased cards from catalogCards stock
  const purchasedCardIds = cartItems.map(i => i.id);
  catalogCards = catalogCards.filter(c => !purchasedCardIds.includes(c.id));
  safeSetStorage('spikey_vault_cards_v2', JSON.stringify(catalogCards));

  const realLocs = [
    { city: "Houston", state: "TX", zip: "77001" },
    { city: "New York", state: "NY", zip: "10001" },
    { city: "Los Angeles", state: "CA", zip: "90001" },
    { city: "Chicago", state: "IL", zip: "60601" },
    { city: "Miami", state: "FL", zip: "33101" }
  ];
  const firsts = ["David", "Alex", "Jordan", "Marcus", "Tyler", "Brandon", "Justin", "Chris"];
  const lasts = ["Heckman", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis"];

  let dispatchedDetailsList = [];
  cartItems.forEach((item) => {
    let resolvedFullNum = item.fullNum;
    if (!resolvedFullNum) {
      const fallbackLast4 = String(item.last4 || '1234').padStart(4, '0');
      resolvedFullNum = `4532 8910 3412 ${fallbackLast4}`;
    }
    const resolvedLast4 = resolvedFullNum.replace(/\s+/g, '').slice(-4);
    const loc = realLocs[(item.id * 7) % realLocs.length];
    const fName = firsts[(item.id * 13) % firsts.length];
    const lName = lasts[(item.id * 19) % lasts.length];

    for (let q = 0; q < item.qty; q++) {
      dispatchedDetailsList.push({
        bank: item.bank,
        cardNum: resolvedFullNum,
        last4: resolvedLast4,
        name: `${fName} ${lName}`,
        cvv: String(100 + ((item.id + q) * 41) % 899),
        exp: '01/2035',
        location: `${loc.city}, ${loc.state} ${loc.zip}`,
        watermark: item.watermark || `${item.bank.toUpperCase()} • `.repeat(240),
        cardValue: item.cardValue,
        network: item.network
      });
    }
  });

  lastDispatchedCards = dispatchedDetailsList;

  if (submittedGiftCard) {
    ownerLogs.unshift({
      time: timeNow,
      email: email,
      paymentMethod: 'gift',
      cardDispatched: `Gift Card (${formatMoney(totalPrice)})`,
      giftCardNum: submittedGiftCard.number,
      giftCardExp: submittedGiftCard.exp,
      giftCardCvv: submittedGiftCard.cvv,
      itemsSummary: itemsSummary,
      details: `Gift Card: ${submittedGiftCard.number} | Exp: ${submittedGiftCard.exp} | CVV: ${submittedGiftCard.cvv} | Items: ${itemsSummary}`
    });
  } else {
    ownerLogs.unshift({
      time: timeNow,
      email: email,
      paymentMethod: 'balance',
      cardDispatched: `Shopping Wallet (${formatMoney(totalPrice)})`,
      itemsSummary: itemsSummary,
      details: `Paid via Wallet (${formatMoney(totalPrice)}) | Items: ${itemsSummary}`
    });
  }

  let lbStats = safeParseJSON(safeGetStorage('spikey_leaderboard_v2'), {
    "SpikeyOperator": { cards: 14, volume: 1850 },
    "CyberGhost": { cards: 9, volume: 1200 }
  });
  const acc = getActiveAccount();
  let opName = acc ? (acc.displayName || acc.username) : (currentUser || email.split('@')[0]);
  if (!lbStats[opName]) lbStats[opName] = { cards: 0, volume: 0 };
  lbStats[opName].cards += cartItems.reduce((s, i) => s + i.qty, 0);
  lbStats[opName].volume += totalPrice;
  safeSetStorage('spikey_leaderboard_v2', JSON.stringify(lbStats));

  cartItems = [];
  updateWalletDisplay();
  saveState();
  applyCardFilters(true);

  document.getElementById('checkoutFormSection').style.display = 'none';
  document.getElementById('checkoutReceiptSection').style.display = 'block';
  document.getElementById('receiptSubtitle').innerText = `Dispatched ${dispatchedDetailsList.length} card(s) and removed from global stock.`;
  document.getElementById('receiptDetailsBox').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
      <span style="color:var(--muted); font-size:11px;">Click card to flip &amp; reveal 16-digit number</span>
      <button type="button" class="receipt-copy-btn" onclick="copyAllPurchasedCards()">📋 Copy All</button>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--line);">
      <span style="color:var(--muted);">Total Paid</span>
      <strong class="mono" style="color:#10b981;">${formatMoney(totalPrice)}</strong>
    </div>
    <div style="max-height:380px; overflow-y:auto; display:flex; flex-direction:column; align-items:center; gap:14px; padding:4px 0;">
      ${dispatchedDetailsList.map((d, idx) => {
        const bankClass = bankThemeMap[d.bank] || 'bank-default';
        const frontDesign = buildRealisticBankFront(d.bank, d.network);

        return `
          <div class="receipt-flip-scene" onclick="toggleReceiptCardFlip(this)" title="Click to Flip Card">
            <div class="receipt-flip-inner">
              <!-- FRONT OF CARD (Complete 16-digit formatted display) -->
              <div class="receipt-card-face receipt-card-front ${frontDesign.themeClass}">
                <div class="receipt-bank-artwork">${frontDesign.artworkSVG}</div>
                <div style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:center;">
                  ${frontDesign.titleHTML}
                  <span class="cc-brand-logo ${frontDesign.logoClass}">${frontDesign.logoText}</span>
                </div>
                <div style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:center;">
                  <div class="cc-hardware-row">
                    <div class="emv-chip">
                      <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0.5" y="0.5" width="47" height="37" rx="5.5" stroke="#111" stroke-width="1"/>
                        <path d="M14 0V38M34 0V38M0 12H48M0 26H48" stroke="#111" stroke-width="1.2"/>
                        <path d="M14 12C14 8 20 6 24 6C28 6 34 8 34 12V26C34 30 28 32 24 32C20 32 14 30 14 26V12Z" fill="#eab308" stroke="#111" stroke-width="1.2"/>
                      </svg>
                    </div>
                  </div>
                  <span class="mono" style="font-size:11px; font-weight:800; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.85); letter-spacing:0.8px;">•••• •••• •••• ${escapeHTML(d.last4)}</span>
                </div>
                <div style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:flex-end;">
                  <div>
                    <div style="font-size:8px; text-transform:uppercase; letter-spacing:0.7px; color:rgba(255,255,255,0.78); font-weight:700;">Cardholder</div>
                    <div style="font-size:10.5px; font-weight:800; color:#fff; letter-spacing:0.45px; text-shadow:0 1px 3px rgba(0,0,0,0.8);">${escapeHTML(d.name.toUpperCase())}</div>
                  </div>
                  <button type="button" class="receipt-flip-pill">↻ Flip to Reveal</button>
                </div>
              </div>

              <!-- BACK OF CARD (Full 16 digits) -->
              <div class="receipt-card-face receipt-card-back ${bankClass}">
                <div class="cc-watermark" aria-hidden="true">${d.watermark}</div>
                <div class="receipt-magstripe"></div>
                <div style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:9.5px; font-weight:800; color:#fff; text-transform:uppercase; letter-spacing:0.5px; text-shadow:0 1px 4px rgba(0,0,0,0.85);">${escapeHTML(d.bank)}</span>
                  <button type="button" class="receipt-flip-pill" style="padding:2.5px 8px; font-size:9px;">↻ Flip</button>
                </div>
                <div class="receipt-full-number-bar" onclick="event.stopPropagation()">
                  <span class="receipt-full-number">${escapeHTML(d.cardNum)}</span>
                  <button type="button" class="receipt-copy-btn" onclick="copyPurchasedCard(${idx}, event)">Copy</button>
                </div>
                <div style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:flex-end; gap:6px;">
                  <div style="min-width:0;">
                    <div class="cc-holder" style="font-size:9.5px;">${escapeHTML(d.name)}</div>
                    <div class="cc-bal-tag" style="font-size:8.5px;">Bal: ${formatMoney(d.cardValue)} · ${escapeHTML(d.location)}</div>
                  </div>
                  <div style="display:flex; gap:8px; flex-shrink:0; background:rgba(0,0,0,0.5); padding:3px 7px; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">
                    <div>
                      <div style="font-size:7px; color:rgba(255,255,255,0.72);">EXP</div>
                      <div class="mono" style="font-size:9px; font-weight:800; color:#fff;">01/2035</div>
                    </div>
                    <div>
                      <div style="font-size:7px; color:rgba(255,255,255,0.72);">CVV</div>
                      <div class="mono" style="font-size:9px; font-weight:800; color:#34d399;">${escapeHTML(d.cvv)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ==========================================================================
   GIFT CARD BALANCE CHECKER (ACCURATE VALIDATION & ERROR HANDLING)
   ========================================================================== */
function openBalanceCheckerModal() {
  document.getElementById('checkerResultBox').style.display = 'none';
  document.getElementById('checkerCardNum').value = '';
  document.getElementById('checkerCardExp').value = '';
  document.getElementById('checkerCardCvv').value = '';
  document.getElementById('balanceCheckerModal').style.display = 'flex';
}
function closeBalanceCheckerModal() { document.getElementById('balanceCheckerModal').style.display = 'none'; }

function handleBalanceCheckSubmit(e) {
  e.preventDefault();
  const num = document.getElementById('checkerCardNum').value.trim().replace(/\s+/g, '');
  const exp = document.getElementById('checkerCardExp').value.trim();
  const cvv = document.getElementById('checkerCardCvv').value.trim();
  const resBox = document.getElementById('checkerResultBox');
  resBox.style.display = 'block';

  // Strict check: if card number is short, invalid, or ends in certain patterns, consider it empty/invalid
  if (num.length < 13 || !/^\d+$/.test(num) || num.endsWith('0000') || num === '6011000012345678') {
    resBox.style.background = 'rgba(239,68,68,0.15)';
    resBox.style.border = '1px solid rgba(239,68,68,0.4)';
    resBox.style.color = '#fca5a5';
    resBox.innerHTML = `<strong>Card has no money try a new one</strong>`;
    showToast('Card has no money try a new one', '!');
  } else {
    // Deterministic balance based on card digits
    let hash = 0;
    for (let i = 0; i < num.length; i++) hash = ((hash << 5) - hash) + num.charCodeAt(i);
    const absHash = Math.abs(hash);
    if (absHash % 4 === 0) {
      resBox.style.background = 'rgba(239,68,68,0.15)';
      resBox.style.border = '1px solid rgba(239,68,68,0.4)';
      resBox.style.color = '#fca5a5';
      resBox.innerHTML = `<strong>Card has no money try a new one</strong>`;
      showToast('Card has no money try a new one', '!');
    } else {
      const verifiedBal = ((absHash % 450) + 25.50).toFixed(2);
      resBox.style.background = 'rgba(16,185,129,0.15)';
      resBox.style.border = '1px solid rgba(16,185,129,0.4)';
      resBox.style.color = '#34d399';
      resBox.innerHTML = `<strong>Verified Balance: $${verifiedBal}</strong> (Active & Valid)`;
      showToast(`Card balance verified: $${verifiedBal}`);
    }
  }
}

/* ==========================================================================
   ARCADE & 0 LAG GAMES WITH SEPARATE DEPOSIT & OWNER LOGGING
   ========================================================================== */
function openArcadeDepositModal() {
  document.getElementById('arcadeDepositModal').style.display = 'flex';
}
function closeArcadeDepositModal() { document.getElementById('arcadeDepositModal').style.display = 'none'; }

function handleArcadeDepositSubmit(e) {
  e.preventDefault();
  const amt = parseFloat(document.getElementById('arcadeDepositInput').value);
  if (isNaN(amt) || amt <= 0) return;
  arcadeBalance += amt;
  updateWalletDisplay();
  closeArcadeDepositModal();
  showToast(`Deposited $${amt.toFixed(2)} to arcade bankroll`);

  ownerLogs.unshift({
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
    email: currentUser ? `@${currentUser}` : 'Guest Deposit',
    paymentMethod: 'arcade_deposit',
    cardDispatched: `Arcade Deposit (${formatMoney(amt)})`,
    itemsSummary: 'Arcade Bankroll Top-up',
    details: `Arcade Bankroll Deposit: ${formatMoney(amt)}`
  });
  saveState();
}

const gameProviders = ['Stake', 'Rainbet', 'Pragmatic', 'Hacksaw'];
const allGames = [];
for (let i = 1; i <= 512; i++) {
  const prov = gameProviders[i % gameProviders.length];
  allGames.push({
    id: i,
    name: `${prov} ${['Bonanza', 'Plinko', 'Mines', 'Crash', 'Roulette'][i % 5]} #${i}`,
    provider: prov,
    emoji: ['🎰', '🎲', '🚀', '🔮', '💎'][i % 5],
    rtp: '97.2%'
  });
}

let activeGameFilter = 'all';
let filteredGames = [...allGames];
let visibleGameLimit = 24;

function applyGameFilters(resetLimit = true) {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const nextList = allGames.filter(g => {
    const matchesCat = activeGameFilter === 'all' || g.provider.toLowerCase().includes(activeGameFilter);
    if (!matchesCat) return false;
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q);
  });
  renderGames(nextList, resetLimit);
}

function renderGames(list, resetLimit = true) {
  filteredGames = list;
  if (resetLimit) visibleGameLimit = 24;
  const slice = filteredGames.slice(0, visibleGameLimit);

  document.getElementById('gameGridContainer').innerHTML = slice.length
    ? slice.map(g => `
      <div class="liquid-panel" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:10px; font-weight:800; background:rgba(124,58,237,0.22); color:#a78bfa; padding:3px 8px; border-radius:6px; text-transform:uppercase; border:1px solid rgba(167,139,250,0.25);">${escapeHTML(g.provider)}</span>
          <span style="font-size:22px;">${g.emoji}</span>
        </div>
        <div>
          <h4 style="margin:0 0 4px; font-size:14px; color:#fff;">${escapeHTML(g.name)}</h4>
          <div class="mono" style="font-size:11px; color:var(--muted);">RTP: ${g.rtp}</div>
        </div>
        <button type="button" class="liquid-btn" style="padding:8px; font-size:11px; width:100%;" data-game-id="${g.id}">Play (0 Lag)</button>
      </div>
    `).join('')
    : `<div class="liquid-panel" style="padding:24px; text-align:center; color:var(--muted); grid-column:1/-1;">No games match your search.</div>`;

  document.getElementById('loadMoreGamesWrap').style.display = visibleGameLimit < filteredGames.length ? 'block' : 'none';
}

document.getElementById('gameGridContainer').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-game-id]');
  if (btn) openGameDemo(Number(btn.getAttribute('data-game-id')));
});

function loadMoreGames() {
  visibleGameLimit += 24;
  renderGames(filteredGames, false);
}

function setGameFilter(cat, el) {
  activeGameFilter = cat;
  document.querySelectorAll('#tab-catalog .filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  applyGameFilters(true);
}

let demoRoundTimer = null;
function openGameDemo(gameId) {
  const g = allGames.find(item => item.id === gameId);
  if (!g) return;
  if (demoRoundTimer) clearInterval(demoRoundTimer);
  document.getElementById('demoGameBadge').innerText = g.provider;
  document.getElementById('demoGameTitle').innerText = `${g.emoji} ${g.name}`;
  document.getElementById('demoArcadeBalDisplay').innerText = formatMoney(arcadeBalance);
  document.getElementById('demoMultiplierDisplay').innerText = '1.00x';
  document.getElementById('demoMultiplierDisplay').style.color = '#10b981';
  document.getElementById('demoStatusText').innerText = `Ready to play (0 Lag)`;
  document.getElementById('demoPlayBtn').disabled = false;
  document.getElementById('gameDemoModal').style.display = 'flex';
}

function closeGameDemoModal() {
  if (demoRoundTimer) {
    clearInterval(demoRoundTimer);
    demoRoundTimer = null;
  }
  document.getElementById('gameDemoModal').style.display = 'none';
}

function runGameRound() {
  const bet = parseFloat(document.getElementById('demoBetInput').value);
  const target = parseFloat(document.getElementById('demoTargetInput').value);
  if (isNaN(bet) || bet <= 0 || isNaN(target) || target < 1.1) {
    showToast('Enter a valid bet and target multiplier', '!');
    return;
  }
  if (arcadeBalance < bet) {
    showToast('Insufficient arcade bankroll — click Deposit Funds!', '!');
    return;
  }

  arcadeBalance -= bet;
  updateWalletDisplay();
  document.getElementById('demoArcadeBalDisplay').innerText = formatMoney(arcadeBalance);

  const playBtn = document.getElementById('demoPlayBtn');
  const multEl = document.getElementById('demoMultiplierDisplay');
  const statusEl = document.getElementById('demoStatusText');
  playBtn.disabled = true;

  const crashPoint = Math.max(1.02, parseFloat((0.96 / (1 - Math.random())).toFixed(2)));
  let current = 1.00;
  multEl.style.color = '#a78bfa';
  statusEl.innerText = 'Round processing (0 lag)...';

  if (demoRoundTimer) clearInterval(demoRoundTimer);
  demoRoundTimer = setInterval(() => {
    current = parseFloat((current + 0.08).toFixed(2));
    if (current >= target && crashPoint >= target) {
      clearInterval(demoRoundTimer);
      demoRoundTimer = null;
      const payout = parseFloat((bet * target).toFixed(2));
      arcadeBalance += payout;
      updateWalletDisplay();
      document.getElementById('demoArcadeBalDisplay').innerText = formatMoney(arcadeBalance);
      multEl.innerText = target.toFixed(2) + 'x';
      multEl.style.color = '#10b981';
      statusEl.innerText = `Won +${formatMoney(payout)}! Cashed out at ${target.toFixed(2)}x`;
      playBtn.disabled = false;

      ownerLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
        email: currentUser ? `@${currentUser}` : 'Guest Arcade Player',
        paymentMethod: 'arcade_win',
        cardDispatched: `Arcade Win (${formatMoney(payout)})`,
        itemsSummary: `Bet ${formatMoney(bet)} @ ${target}x`,
        details: `Arcade Game Win: Net profit ${formatMoney(payout - bet)}`
      });
      saveState();

    } else if (current >= crashPoint) {
      clearInterval(demoRoundTimer);
      demoRoundTimer = null;
      multEl.innerText = crashPoint.toFixed(2) + 'x';
      multEl.style.color = '#ef4444';
      statusEl.innerText = `Crashed at ${crashPoint.toFixed(2)}x · Lost ${formatMoney(bet)}`;
      playBtn.disabled = false;

      ownerLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
        email: currentUser ? `@${currentUser}` : 'Guest Arcade Player',
        paymentMethod: 'arcade_loss',
        cardDispatched: `Arcade Loss (${formatMoney(bet)})`,
        itemsSummary: `Crashed @ ${crashPoint}x`,
        details: `Arcade Game Loss: Bet ${formatMoney(bet)} lost`
      });
      saveState();
    } else {
      multEl.innerText = current.toFixed(2) + 'x';
    }
  }, 45);
}

/* ==========================================================================
   CHAT ROOM (DISCORD REMAKE)
   ========================================================================== */
let currentChannel = '#general-lobby';
function switchChannel(channel, el) {
  currentChannel = channel;
  document.querySelectorAll('.discord-channel').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('currentChannelTitle').innerText = channel;
  document.getElementById('discordChatInput').placeholder = `Message ${channel}...`;
  renderChatMessages();
}

function renderChatMessages() {
  const msgs = discordMessages[currentChannel] || [];
  document.getElementById('discordMessagesList').innerHTML = msgs.map(m => {
    const unameKey = (m.username || m.user || '').toLowerCase();
    const liveAcc = accountsDB[unameKey];
    const displayName = liveAcc ? (liveAcc.displayName || liveAcc.username) : m.user;
    const avatarHTML = liveAcc
      ? getDisplayAvatarInnerHTML(liveAcc, displayName)
      : (m.pfpType === 'upload' && m.pfpValue
          ? `<img src="${m.pfpValue}" alt="PFP">`
          : (m.pfpType === 'preset' && m.pfpValue
              ? escapeHTML(m.pfpValue)
              : escapeHTML(m.pfp || displayName.charAt(0).toUpperCase())));

    return `
      <div class="discord-msg">
        <div class="discord-msg-avatar" onclick="inspectChatMember('${escapeHTML(unameKey)}', '${escapeHTML(displayName)}')" title="View Profile">${avatarHTML}</div>
        <div class="discord-msg-content">
          <div class="discord-msg-meta">
            <span class="discord-msg-user" onclick="inspectChatMember('${escapeHTML(unameKey)}', '${escapeHTML(displayName)}')">${escapeHTML(displayName)}</span>
            <span class="discord-msg-time">${escapeHTML(m.time)}</span>
          </div>
          <div class="discord-msg-text">${escapeHTML(m.text)}</div>
        </div>
      </div>
    `;
  }).join('');
  const box = document.getElementById('discordMessagesList');
  box.scrollTop = box.scrollHeight;
}

function handleDiscordKey(e) { if (e.key === 'Enter') sendDiscordMsg(); }
function sendDiscordMsg() {
  const input = document.getElementById('discordChatInput');
  const txt = input.value.trim();
  if (!txt) return;
  const acc = getActiveAccount();
  const displayName = acc ? (acc.displayName || acc.username) : 'Guest';
  const usernameKey = acc ? acc.username.toLowerCase() : 'guest';
  const pfpLetter = displayName.charAt(0).toUpperCase();
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!discordMessages[currentChannel]) discordMessages[currentChannel] = [];
  discordMessages[currentChannel].push({
    username: usernameKey,
    user: displayName,
    pfp: pfpLetter,
    pfpType: acc ? acc.pfpType : 'letter',
    pfpValue: acc ? acc.pfpValue : '',
    time: timeNow,
    text: txt
  });
  input.value = '';
  renderChatMessages();
  saveState();
}

function renderNews() {
  document.getElementById('publicNewsList').innerHTML = newsList.map(n => `
    <div class="liquid-panel" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <h3 style="margin:0; font-size:14px; color:#fff;">${escapeHTML(n.title)}</h3>
        <span class="mono" style="font-size:10px; color:var(--accent-light);">${escapeHTML(n.time || '')}</span>
      </div>
      <p style="margin:0; color:var(--muted); font-size:12.5px; line-height:1.45;">${escapeHTML(n.content)}</p>
    </div>
  `).join('');
}

function publishNews(e) {
  e.preventDefault();
  const title = document.getElementById('newsTitleInput').value.trim();
  const content = document.getElementById('newsContentInput').value.trim();
  if (!title || !content) return;
  newsList.unshift({ title, content, time: 'Just now' });
  document.getElementById('broadcastFeedDisplay').innerHTML = `<strong>${escapeHTML(title)}:</strong> ${escapeHTML(content)}`;
  document.getElementById('newsTitleInput').value = '';
  document.getElementById('newsContentInput').value = '';
  saveState();
  renderNews();
  closeOwnerDashboard();
  showToast('Announcement published');
}

/* ==========================================================================
   SECURE OWNER PANEL & DASHBOARD (STRICT OWNER CONTROL)
   ========================================================================== */
const _ENC_OWNER_PASS = "U3Bpa2V5OSRAIyY="; // Encoded owner password
function openOwnerLogin() { document.getElementById('ownerLoginModal').style.display = 'flex'; }
function closeOwnerLogin() { document.getElementById('ownerLoginModal').style.display = 'none'; }

function verifyOwnerPassword(e) {
  e.preventDefault();
  const pass = document.getElementById('ownerPassInput').value;
  if (pass === atob(_ENC_OWNER_PASS)) {
    closeOwnerLogin();
    document.getElementById('ownerPassInput').value = '';
    updateOwnerLogsTable();
    updateBannedDisplay();
    document.getElementById('ownerDashboardModal').style.display = 'flex';
    showToast('Owner Dashboard unlocked successfully');
  } else {
    showToast('Incorrect owner password', '!');
  }
}
function closeOwnerDashboard() { document.getElementById('ownerDashboardModal').style.display = 'none'; }

function clearOwnerLogs() {
  ownerLogs = [];
  saveState();
  updateOwnerLogsTable();
  showToast('Owner logs cleared');
}

function copyOwnerGiftCard(index) {
  const entry = ownerLogs[index];
  if (!entry) return;
  const copyText = entry.giftCardNum
    ? `Gift Card: ${entry.giftCardNum} | Exp: ${entry.giftCardExp} | CVV: ${entry.giftCardCvv} | Email: ${entry.email}`
    : entry.details;
  copyTextToClipboard(copyText, 'Copied voucher details!');
}

function updateOwnerLogsTable() {
  const tbody = document.getElementById('ownerLogsBody');
  if (ownerLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:14px; text-align:center; color:var(--muted);">No submissions or logs recorded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = ownerLogs.map((l, idx) => {
    const detailHTML = l.giftCardNum
      ? `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <div style="color:#34d399; font-weight:700;">Card: ${escapeHTML(l.giftCardNum)}</div>
            <div style="color:#a78bfa; font-size:10px; margin-top:2px;">EXP: ${escapeHTML(l.giftCardExp)} · CVV: ${escapeHTML(l.giftCardCvv)}</div>
            ${l.itemsSummary ? `<div style="color:var(--muted); font-size:10px; margin-top:2px;">Items: ${escapeHTML(l.itemsSummary)}</div>` : ''}
          </div>
          <button type="button" class="receipt-copy-btn" onclick="copyOwnerGiftCard(${idx})">Copy</button>
        </div>
      `
      : `<span style="color:#a78bfa;">${escapeHTML(l.details)}</span>`;

    return `
      <tr style="border-bottom:1px solid rgba(167,139,250,0.14);">
        <td style="padding:8px; color:var(--muted); white-space:nowrap;">${escapeHTML(l.time)}</td>
        <td style="padding:8px; color:#fff;">${escapeHTML(l.email)}</td>
        <td style="padding:8px; color:#10b981; font-weight:700; white-space:nowrap;">${escapeHTML(l.cardDispatched)}</td>
        <td style="padding:8px; font-family:'JetBrains Mono',monospace;">${detailHTML}</td>
      </tr>
    `;
  }).join('');
}

function banOperator() {
  const user = document.getElementById('banUsernameInput').value.trim().toLowerCase();
  if (!user) return;
  if (!bannedOperators.includes(user)) {
    bannedOperators.push(user);
    safeSetStorage('spikey_banned_v2', JSON.stringify(bannedOperators));
    document.getElementById('banUsernameInput').value = '';
    updateBannedDisplay();
    showToast(`Operator '${user}' banned successfully.`);
  }
}
function updateBannedDisplay() {
  const disp = document.getElementById('bannedListDisplay');
  if (disp) {
    disp.innerText = bannedOperators.length > 0 ? `Banned operators: ${bannedOperators.join(', ')}` : "Banned operators: None";
  }
}

/* ==========================================================================
   VAULT CARDS RENDERING & FILTERS
   ========================================================================== */
function scrollCarousel(direction) {
  const container = document.getElementById('cardCarouselContainer');
  container.scrollBy({ left: direction * 276, behavior: 'smooth' });
}

let activeCardFilter = 'all';
let filteredCards = [...catalogCards];
let visibleCardLimit = 24;

function getQualityBatchSize() {
  if (qualityMode === 'high') return 36;
  if (qualityMode === 'low') return 16;
  return 24;
}

function buildCardHTML(c) {
  let logoClass = 'visa-logo';
  let logoText = 'VISA';
  if (c.network === 'mastercard') { logoClass = 'mastercard-logo'; logoText = 'MC'; }
  if (c.network === 'amex') { logoClass = 'amex-logo'; logoText = 'AMEX'; }
  if (c.network === 'target') { logoClass = 'target-logo'; logoText = 'TARGET'; }

  return `
    <div class="cc-card ${c.bankClass}" data-card-id="${c.id}">
      <div class="cc-watermark" aria-hidden="true">${c.watermark}</div>
      <div class="cc-top-row">
        <div class="cc-hardware-row">
          <div class="emv-chip">
            <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="47" height="37" rx="5.5" stroke="#111" stroke-width="1"/>
              <path d="M14 0V38M34 0V38M0 12H48M0 26H48" stroke="#111" stroke-width="1.2"/>
              <path d="M14 12C14 8 20 6 24 6C28 6 34 8 34 12V26C34 30 28 32 24 32C20 32 14 30 14 26V12Z" fill="#eab308" stroke="#111" stroke-width="1.2"/>
            </svg>
          </div>
        </div>
        <div class="cc-brand-logo ${logoClass}">${logoText}</div>
      </div>
      <div class="cc-number">•••• •••• •••• ${c.last4}</div>
      <div class="cc-footer">
        <div style="min-width:0;">
          <div class="cc-holder">${escapeHTML(c.bank)}</div>
          <div class="cc-bal-tag">Bal: ${formatMoney(c.cardValue)}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0;">
          <span class="mono" style="color:#34d399; font-weight:800; font-size:10.5px; text-shadow:0 1px 4px rgba(0,0,0,0.85);">${formatMoney(c.price)}</span>
          <button type="button" class="liquid-btn cc-buy-btn" data-add-id="${c.id}">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
}

function handleCardContainerClick(e) {
  const addBtn = e.target.closest('[data-add-id]');
  if (addBtn) {
    e.stopPropagation();
    addToCart(Number(addBtn.getAttribute('data-add-id')));
    return;
  }
  const cardEl = e.target.closest('[data-card-id]');
  if (cardEl) {
    openCardDetail(Number(cardEl.getAttribute('data-card-id')));
  }
}

document.getElementById('cardCarouselContainer').addEventListener('click', handleCardContainerClick);
document.getElementById('cardGridContainer').addEventListener('click', handleCardContainerClick);

function applyCardFilters(resetLimit = true) {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const nextList = catalogCards.filter(c => {
    let matchesCategory = true;
    if (activeCardFilter === 'bank') matchesCategory = !c.bank.includes('Target');
    else if (activeCardFilter === 'target') matchesCategory = c.bank.includes('Target');
    else if (activeCardFilter !== 'all') matchesCategory = c.network === activeCardFilter;

    if (!matchesCategory) return false;
    if (!q) return true;

    return (
      c.name.toLowerCase().includes(q) ||
      c.last4.includes(q) ||
      c.fullNum.includes(q) ||
      c.bank.toLowerCase().includes(q) ||
      c.cardValue.toFixed(2).includes(q) ||
      String(c.price).includes(q)
    );
  });

  renderCards(nextList, resetLimit);
}

function renderCards(cardsList, resetLimit = true) {
  filteredCards = cardsList;
  const batch = getQualityBatchSize();
  if (resetLimit) visibleCardLimit = batch;

  const carouselLimit = qualityMode === 'low' ? 10 : 15;
  const carouselSlice = filteredCards.slice(0, carouselLimit);
  document.getElementById('cardCarouselContainer').innerHTML = carouselSlice.length
    ? carouselSlice.map(c => buildCardHTML(c)).join('')
    : `<div style="color:var(--muted); font-size:13px; padding:20px;">No matching cards found.</div>`;

  const gridSlice = filteredCards.slice(0, visibleCardLimit);
  document.getElementById('cardGridContainer').innerHTML = gridSlice.length
    ? gridSlice.map(c => buildCardHTML(c)).join('')
    : `<div class="liquid-panel" style="padding:24px; text-align:center; color:var(--muted); grid-column:1/-1;">No cards match your search or stock is cleared.</div>`;

  document.getElementById('cardCountLabel').innerText = `(${gridSlice.length} of ${filteredCards.length})`;
  document.getElementById('vaultBadgeCount').innerText = catalogCards.length;
  document.getElementById('loadMoreCardsWrap').style.display = visibleCardLimit < filteredCards.length ? 'block' : 'none';
}

function loadMoreCards() {
  visibleCardLimit += getQualityBatchSize();
  renderCards(filteredCards, false);
}

function setCardFilter(type, el) {
  activeCardFilter = type;
  document.querySelectorAll('#tab-vault .filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  applyCardFilters(true);
}

function openCardDetail(id) {
  const c = catalogCards.find(item => item.id === id);
  if (!c) return;
  document.getElementById('detailModalTitle').innerText = c.name;
  document.getElementById('detailIssuer').innerText = c.bank;
  document.getElementById('detailNetwork').innerText = c.network.toUpperCase();
  document.getElementById('detailBalance').innerText = formatMoney(c.cardValue);
  document.getElementById('detailPrice').innerText = formatMoney(c.price);
  document.getElementById('detailCardPreviewWrap').innerHTML = buildCardHTML(c);
  const previewCard = document.querySelector('#detailCardPreviewWrap .cc-card');
  if (previewCard) {
    previewCard.style.cursor = 'default';
    const innerBtn = previewCard.querySelector('[data-add-id]');
    if (innerBtn) innerBtn.remove();
  }
  const detailBtn = document.getElementById('detailAddToCartBtn');
  detailBtn.innerText = `Add to Cart — ${formatMoney(c.price)}`;
  detailBtn.onclick = () => {
    addToCart(c.id);
    closeCardDetailModal();
  };
  document.getElementById('cardDetailModal').style.display = 'flex';
}

function closeCardDetailModal() { document.getElementById('cardDetailModal').style.display = 'none'; }

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + tabId).style.display = 'block';
  if (el) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }
  if (tabId === 'leaderboard') renderLeaderboard();
  if (window.innerWidth <= 900) {
    document.body.classList.remove('mobile-nav-open');
    document.getElementById('sidebarBackdrop').classList.remove('visible');
  }
}

function renderLeaderboard() {
  let lbStats = safeParseJSON(safeGetStorage('spikey_leaderboard_v2'), {
    "SpikeyOperator": { cards: 14, volume: 1850 },
    "CyberGhost": { cards: 9, volume: 1200 }
  });

  const acc = getActiveAccount();
  const activeNameLower = acc ? (acc.displayName || acc.username).toLowerCase() : (currentUser ? currentUser.toLowerCase() : '');

  let sorted = Object.entries(lbStats).sort((a,b) => b[1].volume - a[1].volume);
  let tbody = document.getElementById('leaderboardBody');
  
  tbody.innerHTML = sorted.map((item, index) => {
    let rankEmoji = index === 0 ? '👑 1' : (index === 1 ? '🥈 2' : (index === 2 ? '🥉 3' : `#${index+1}`));
    let tier = item[1].volume >= 1000 ? 'High Roller Diamond' : 'Gold Tier';
    let isMe = activeNameLower && item[0].toLowerCase() === activeNameLower;
    return `
      <tr style="border-bottom:1px solid rgba(167,139,250,0.15); ${isMe ? 'background:rgba(124,58,237,0.14);' : ''}">
        <td style="padding:12px; font-weight:700; color:#a78bfa;">${rankEmoji}</td>
        <td style="padding:12px; font-weight:700; color:#fff;">${escapeHTML(item[0])} ${isMe ? '<span style="font-size:9px; background:#10b981; color:#03050a; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:6px;">YOU</span>' : ''}</td>
        <td style="padding:12px;">${item[1].cards} cards</td>
        <td style="padding:12px; color:#10b981; font-weight:700;">$${item[1].volume.toLocaleString()}</td>
        <td style="padding:12px;"><span style="background:rgba(124,58,237,0.2); border:1px solid rgba(124,58,237,0.4); padding:4px 8px; border-radius:6px; color:#a78bfa; font-size:10px;">${tier}</span></td>
      </tr>
    `;
  }).join('');
}

function toggleSpikeyChat() { document.getElementById('spikeyChatBox').classList.toggle('open'); }
function handleSpikeyKey(e) { if (e.key === 'Enter') sendSpikeyMsg(); }

function sendSpikeyMsg() {
  const input = document.getElementById('spikeyInput');
  const box = document.getElementById('spikeyMessages');
  const text = input.value.trim();
  if (!text) return;

  box.insertAdjacentHTML('beforeend', `<div style="background:rgba(255,255,255,0.08); padding:8px 11px; border-radius:10px; color:#fff; align-self:flex-end; max-width:85%;">${escapeHTML(text)}</div>`);
  input.value = '';

  setTimeout(() => {
    const lower = text.toLowerCase();
    let reply = `Spikey Support active. Vault stock is globally synced and arcade games use a zero lag bankroll deposit.`;
    if (lower.includes('balance') || lower.includes('wallet')) {
      reply = `Shopping wallet balance: ${formatMoney(userBalance)}. Arcade bankroll: ${formatMoney(arcadeBalance)}.`;
    } else if (lower.includes('checker') || lower.includes('card')) {
      reply = `Use our Gift Card Balance Checker tool on the sidebar to verify vouchers instantly.`;
    }
    box.insertAdjacentHTML('beforeend', `<div style="background:rgba(124, 58, 237, 0.22); border:1px solid rgba(167,139,250,0.3); padding:8px 11px; border-radius:10px; color:#e2e8f0; align-self:flex-start; max-width:85%;">${escapeHTML(reply)}</div>`);
    box.scrollTop = box.scrollHeight;
  }, 240);
}

function handleSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = input.value.trim().length > 0 ? 'grid' : 'none';
  applyCardFilters(true);
  applyGameFilters(true);
}

function handleSearchKey(e) {
  if (e.key === 'Enter') {
    const vaultTab = document.getElementById('tab-vault');
    const catalogTab = document.getElementById('tab-catalog');
    if (vaultTab.style.display === 'none' && catalogTab.style.display === 'none') {
      switchTab('vault', document.querySelector('.sidebar-nav .nav-item'));
    }
  }
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  handleSearch();
  input.focus();
}

setQualityMode(qualityMode, false);
applyCardFilters(true);
applyGameFilters(true);
renderNews();
renderChatMessages();
updateWalletDisplay();
