/**
 * Cookie Manager Pro - Popup Script
 * Handles all UI interactions and communication with background service worker
 */

// ==================== Global State ====================
let currentDomain = '';
let allCookies = [];
let filteredCookies = [];
let currentEditCookie = null;
let confirmCallback = null;

// DOM Elements (initialized on load)
const elements = {};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await checkFirstRun();
  await loadCurrentDomain();
  await loadCookies();
  await loadPresets();
});

function initializeElements() {
  elements.currentDomain = document.getElementById('currentDomain');
  elements.cookieList = document.getElementById('cookieList');
  elements.emptyState = document.getElementById('emptyState');
  elements.searchInput = document.getElementById('searchInput');
  elements.domainFilter = document.getElementById('domainFilter');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  
  // Modals
  elements.cookieModal = document.getElementById('cookieModal');
  elements.importModal = document.getElementById('importModal');
  elements.exportModal = document.getElementById('exportModal');
  elements.presetSaveModal = document.getElementById('presetSaveModal');
  elements.presetRenameModal = document.getElementById('presetRenameModal');
  elements.confirmModal = document.getElementById('confirmModal');
  elements.welcomeModal = document.getElementById('welcomeModal');
  
  // Preset elements
  elements.presetSelect = document.getElementById('presetSelect');
  elements.presetHeader = document.getElementById('presetHeader');
  elements.presetContent = document.getElementById('presetContent');
}

// ==================== Welcome Screen ====================

async function checkFirstRun() {
  try {
    const result = await chrome.storage.local.get(['hasSeenWelcome']);
    
    if (!result.hasSeenWelcome) {
      await showWelcomeScreen();
    }
  } catch (error) {
    console.error('Error checking first run:', error);
  }
}

async function showWelcomeScreen() {
  openModal('welcomeModal');
  await initializeEncryption();
}

async function initializeEncryption() {
  try {
    await getOrCreateKey();
    
    const encryptionStatusEl = document.getElementById('encryptionStatus');
    encryptionStatusEl.innerHTML = `
      <div class="encryption-ready">
        <span class="encryption-ready-icon">🔒</span>
        <span>Encryption is ready</span>
      </div>
    `;
    
    const getStartedBtn = document.getElementById('getStartedBtn');
    getStartedBtn.disabled = false;
  } catch (error) {
    console.error('Error initializing encryption:', error);
    const encryptionStatusEl = document.getElementById('encryptionStatus');
    encryptionStatusEl.innerHTML = `
      <div style="color: #ef4444; font-size: 14px;">
        ⚠️ Error setting up encryption
      </div>
    `;
  }
}

async function handleGetStarted() {
  try {
    await chrome.storage.local.set({ hasSeenWelcome: true });
    closeModal('welcomeModal');
  } catch (error) {
    console.error('Error setting welcome flag:', error);
    showToast('Error saving settings', 'error');
  }
}

// ==================== Helper Functions ====================

async function sendMessage(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function showLoading() {
  elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatDate(timestamp) {
  if (!timestamp) return 'Session';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

function truncateValue(value, maxLength = 30) {
  if (!value) return '';
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function validateCookieForm() {
  const name = document.getElementById('cookieName').value.trim();
  const value = document.getElementById('cookieValue').value.trim();
  const domain = document.getElementById('cookieDomain').value.trim();
  
  if (!name) {
    showToast('Cookie name is required', 'error');
    return false;
  }
  
  if (!value) {
    showToast('Cookie value is required', 'error');
    return false;
  }
  
  if (!domain) {
    showToast('Domain is required', 'error');
    return false;
  }
  
  return true;
}

// ==================== Domain & Cookie Operations ====================

async function loadCurrentDomain() {
  try {
    const response = await sendMessage('getCurrentTabDomain');
    if (response.success) {
      currentDomain = response.domain;
      elements.currentDomain.textContent = currentDomain;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    elements.currentDomain.textContent = 'Error loading domain';
    showToast('Failed to load current domain: ' + error.message, 'error');
  }
}

async function loadCookies(domain = currentDomain) {
  try {
    showLoading();
    const response = await sendMessage('getCookies', { domain });
    
    if (response.success) {
      allCookies = response.cookies;
      updateDomainFilter();
      filterCookies();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to load cookies: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

function updateDomainFilter() {
  const domains = new Set();
  allCookies.forEach(cookie => domains.add(cookie.domain));
  
  const currentValue = elements.domainFilter.value;
  elements.domainFilter.innerHTML = '<option value="all">All Domains</option>';
  
  Array.from(domains).sort().forEach(domain => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    elements.domainFilter.appendChild(option);
  });
  
  if (currentValue && domains.has(currentValue)) {
    elements.domainFilter.value = currentValue;
  }
}

function filterCookies() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const selectedDomain = elements.domainFilter.value;
  
  filteredCookies = allCookies.filter(cookie => {
    const matchesSearch = !searchTerm || 
      cookie.name.toLowerCase().includes(searchTerm) ||
      cookie.value.toLowerCase().includes(searchTerm);
    
    const matchesDomain = selectedDomain === 'all' || cookie.domain === selectedDomain;
    
    return matchesSearch && matchesDomain;
  });
  
  renderCookies(filteredCookies);
}

function renderCookies(cookies) {
  if (!cookies || cookies.length === 0) {
    elements.emptyState.style.display = 'flex';
    elements.cookieList.innerHTML = '';
    elements.cookieList.appendChild(elements.emptyState);
    return;
  }
  
  elements.emptyState.style.display = 'none';
  elements.cookieList.innerHTML = '';
  
  cookies.forEach(cookie => {
    const cookieCard = document.createElement('div');
    cookieCard.className = 'cookie-card glass-card';
    cookieCard.innerHTML = `
      <div class="cookie-header">
        <div class="cookie-name" title="${cookie.name}">${cookie.name}</div>
        <div class="cookie-actions">
          <button class="icon-btn edit-cookie" title="Edit cookie">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.3333 2L14 4.66667L5.33333 13.3333H2.66667V10.6667L11.3333 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="icon-btn delete-cookie" title="Delete cookie">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="cookie-details">
        <div class="cookie-value" title="${cookie.value}">${truncateValue(cookie.value)}</div>
        <div class="cookie-meta">
          <span class="meta-item">🌐 ${cookie.domain}</span>
          <span class="meta-item">⏰ ${formatDate(cookie.expirationDate)}</span>
        </div>
        ${cookie.secure ? '<span class="badge badge-secure">🔒 Secure</span>' : ''}
        ${cookie.httpOnly ? '<span class="badge badge-httponly">🚫 HttpOnly</span>' : ''}
        ${cookie.sameSite ? `<span class="badge badge-samesite">🔄 ${cookie.sameSite}</span>` : ''}
      </div>
    `;
    
    // Set cookie data using dataset property to avoid HTML encoding issues
    const editBtn = cookieCard.querySelector('.edit-cookie');
    const deleteBtn = cookieCard.querySelector('.delete-cookie');
    editBtn.dataset.cookie = JSON.stringify(cookie);
    deleteBtn.dataset.cookie = JSON.stringify(cookie);
    
    elements.cookieList.appendChild(cookieCard);
  });
  
  document.querySelectorAll('.edit-cookie').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cookie = JSON.parse(e.currentTarget.dataset.cookie);
      openEditCookieModal(cookie);
    });
  });
  
  document.querySelectorAll('.delete-cookie').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cookie = JSON.parse(e.currentTarget.dataset.cookie);
      handleDeleteCookie(cookie);
    });
  });
}

async function addCookie() {
  if (!validateCookieForm()) return;
  
  const cookieDetails = {
    name: document.getElementById('cookieName').value.trim(),
    value: document.getElementById('cookieValue').value.trim(),
    domain: document.getElementById('cookieDomain').value.trim(),
    path: document.getElementById('cookiePath').value.trim() || '/',
    secure: document.getElementById('cookieSecure').checked,
    httpOnly: document.getElementById('cookieHttpOnly').checked,
    sameSite: document.getElementById('cookieSameSite').value
  };
  
  const expiresInput = document.getElementById('cookieExpires').value;
  if (expiresInput) {
    const expiresDate = new Date(expiresInput);
    cookieDetails.expirationDate = Math.floor(expiresDate.getTime() / 1000);
  }
  
  try {
    showLoading();
    const response = await sendMessage('setCookie', { cookieDetails });
    
    if (response.success) {
      showToast('Cookie added successfully');
      closeModal('cookieModal');
      await loadCookies();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to add cookie: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

function openEditCookieModal(cookie) {
  currentEditCookie = cookie;
  
  document.getElementById('cookieModalTitle').textContent = 'Edit Cookie';
  document.getElementById('cookieName').value = cookie.name;
  document.getElementById('cookieValue').value = cookie.value;
  document.getElementById('cookieDomain').value = cookie.domain;
  document.getElementById('cookiePath').value = cookie.path || '/';
  document.getElementById('cookieSecure').checked = cookie.secure || false;
  document.getElementById('cookieHttpOnly').checked = cookie.httpOnly || false;
  document.getElementById('cookieSameSite').value = cookie.sameSite || 'no_restriction';
  
  if (cookie.expirationDate && !cookie.session) {
    const date = new Date(cookie.expirationDate * 1000);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('cookieExpires').value = localDateTime;
  } else {
    document.getElementById('cookieExpires').value = '';
  }
  
  openModal('cookieModal');
}

async function updateCookie() {
  if (!validateCookieForm()) return;
  
  if (!currentEditCookie) {
    await addCookie();
    return;
  }
  
  const cookieDetails = {
    name: document.getElementById('cookieName').value.trim(),
    value: document.getElementById('cookieValue').value.trim(),
    domain: document.getElementById('cookieDomain').value.trim(),
    path: document.getElementById('cookiePath').value.trim() || '/',
    secure: document.getElementById('cookieSecure').checked,
    httpOnly: document.getElementById('cookieHttpOnly').checked,
    sameSite: document.getElementById('cookieSameSite').value
  };
  
  const expiresInput = document.getElementById('cookieExpires').value;
  if (expiresInput) {
    const expiresDate = new Date(expiresInput);
    cookieDetails.expirationDate = Math.floor(expiresDate.getTime() / 1000);
  }
  
  try {
    showLoading();
    const response = await sendMessage('setCookie', { cookieDetails });
    
    if (response.success) {
      showToast('Cookie updated successfully');
      closeModal('cookieModal');
      currentEditCookie = null;
      await loadCookies();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to update cookie: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleDeleteCookie(cookie) {
  showConfirmDialog(
    'Delete Cookie',
    `Are you sure you want to delete "${cookie.name}"?`,
    async () => {
      try {
        showLoading();
        const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}`;
        const response = await sendMessage('deleteCookie', {
          cookieDetails: { url, name: cookie.name }
        });
        
        if (response.success) {
          showToast('Cookie deleted successfully');
          await loadCookies();
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        showToast('Failed to delete cookie: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    }
  );
}

// ==================== Preset Management ====================

async function loadPresets() {
  try {
    const response = await sendMessage('getPresets');
    
    if (response.success) {
      const presets = response.presets;
      elements.presetSelect.innerHTML = '<option value="">Select a preset...</option>';
      
      presets.forEach(presetName => {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        elements.presetSelect.appendChild(option);
      });
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to load presets: ' + error.message, 'error');
  }
}

async function saveCurrentAsPreset() {
  const presetName = document.getElementById('presetName').value.trim();
  
  if (!presetName) {
    showToast('Preset name is required', 'error');
    return;
  }
  
  try {
    showLoading();
    const cookiesResponse = await sendMessage('getCookies', { domain: currentDomain });
    
    if (!cookiesResponse.success) {
      throw new Error(cookiesResponse.error);
    }
    
    const cookies = cookiesResponse.cookies;
    const response = await sendMessage('savePreset', { presetName, cookies });
    
    if (response.success) {
      showToast('Preset saved successfully');
      closeModal('presetSaveModal');
      document.getElementById('presetName').value = '';
      await loadPresets();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to save preset: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function applySelectedPreset() {
  const presetName = elements.presetSelect.value;
  
  if (!presetName) {
    showToast('Please select a preset', 'error');
    return;
  }
  
  showConfirmDialog(
    'Load Preset',
    `Load preset "${presetName}" to ${currentDomain}? This will add cookies from the preset.`,
    async () => {
      try {
        showLoading();
        const response = await sendMessage('applyPreset', { presetName, domain: currentDomain });
        
        if (response.success) {
          showToast(`Preset loaded: ${response.applied} cookies applied`);
          await loadCookies();
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        showToast('Failed to load preset: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    }
  );
}

async function deleteSelectedPreset() {
  const presetName = elements.presetSelect.value;
  
  if (!presetName) {
    showToast('Please select a preset', 'error');
    return;
  }
  
  showConfirmDialog(
    'Delete Preset',
    `Are you sure you want to delete preset "${presetName}"?`,
    async () => {
      try {
        showLoading();
        const response = await sendMessage('deletePreset', { presetName });
        
        if (response.success) {
          showToast('Preset deleted successfully');
          await loadPresets();
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        showToast('Failed to delete preset: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    }
  );
}

async function renameSelectedPreset() {
  const oldName = elements.presetSelect.value;
  
  if (!oldName) {
    showToast('Please select a preset', 'error');
    return;
  }
  
  document.getElementById('presetNewName').value = oldName;
  openModal('presetRenameModal');
}

async function confirmRenamePreset() {
  const oldName = elements.presetSelect.value;
  const newName = document.getElementById('presetNewName').value.trim();
  
  if (!newName) {
    showToast('New preset name is required', 'error');
    return;
  }
  
  if (oldName === newName) {
    showToast('New name must be different', 'error');
    return;
  }
  
  try {
    showLoading();
    const response = await sendMessage('renamePreset', { oldName, newName });
    
    if (response.success) {
      showToast('Preset renamed successfully');
      closeModal('presetRenameModal');
      await loadPresets();
      elements.presetSelect.value = newName;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to rename preset: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Import/Export ====================

async function exportCurrentCookies() {
  const encrypted = document.getElementById('exportEncrypted').checked;
  
  try {
    showLoading();
    const response = await sendMessage('exportCookies', { domain: currentDomain, encrypted });
    
    if (response.success) {
      document.getElementById('exportData').value = response.data;
      openModal('exportModal');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to export cookies: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function copyExportData() {
  const exportData = document.getElementById('exportData').value;
  
  try {
    await navigator.clipboard.writeText(exportData);
    showToast('Copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy: ' + error.message, 'error');
  }
}

async function importCookiesData() {
  const jsonData = document.getElementById('importData').value.trim();
  const encrypted = document.getElementById('importEncrypted').checked;
  
  if (!jsonData) {
    showToast('Please paste cookie data', 'error');
    return;
  }
  
  try {
    showLoading();
    const response = await sendMessage('importCookies', { jsonData, encrypted });
    
    if (response.success) {
      showToast(`Import successful: ${response.imported} cookies imported`);
      closeModal('importModal');
      document.getElementById('importData').value = '';
      await loadCookies();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showToast('Failed to import cookies: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Modal Management ====================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
  }
  
  if (modalId === 'cookieModal') {
    currentEditCookie = null;
    document.getElementById('cookieModalTitle').textContent = 'Add Cookie';
    document.getElementById('cookieForm').reset();
    document.getElementById('cookieDomain').value = currentDomain;
  }
}

function showConfirmDialog(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  openModal('confirmModal');
}

// ==================== Event Listeners ====================

function setupEventListeners() {
  // Search and filter
  elements.searchInput.addEventListener('input', filterCookies);
  elements.domainFilter.addEventListener('change', filterCookies);
  
  // Main action buttons
  document.getElementById('addCookieBtn').addEventListener('click', () => {
    currentEditCookie = null;
    document.getElementById('cookieModalTitle').textContent = 'Add Cookie';
    document.getElementById('cookieForm').reset();
    document.getElementById('cookieDomain').value = currentDomain;
    openModal('cookieModal');
  });
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importData').value = '';
    document.getElementById('importEncrypted').checked = false;
    openModal('importModal');
  });
  
  document.getElementById('exportBtn').addEventListener('click', exportCurrentCookies);
  
  // Cookie modal
  document.getElementById('cookieForm').addEventListener('submit', (e) => {
    e.preventDefault();
    updateCookie();
  });
  
  document.getElementById('closeCookieModal').addEventListener('click', () => closeModal('cookieModal'));
  document.getElementById('cancelCookieBtn').addEventListener('click', () => closeModal('cookieModal'));
  
  // Import modal
  document.getElementById('closeImportModal').addEventListener('click', () => closeModal('importModal'));
  document.getElementById('cancelImportBtn').addEventListener('click', () => closeModal('importModal'));
  document.getElementById('confirmImportBtn').addEventListener('click', importCookiesData);
  
  // Export modal
  document.getElementById('closeExportModal').addEventListener('click', () => closeModal('exportModal'));
  document.getElementById('closeExportBtn').addEventListener('click', () => closeModal('exportModal'));
  document.getElementById('copyExportBtn').addEventListener('click', copyExportData);
  
  // Preset buttons
  document.getElementById('savePresetBtn').addEventListener('click', () => {
    document.getElementById('presetName').value = '';
    openModal('presetSaveModal');
  });
  
  document.getElementById('loadPresetBtn').addEventListener('click', applySelectedPreset);
  document.getElementById('deletePresetBtn').addEventListener('click', deleteSelectedPreset);
  document.getElementById('renamePresetBtn').addEventListener('click', renameSelectedPreset);
  
  // Preset save modal
  document.getElementById('closePresetSaveModal').addEventListener('click', () => closeModal('presetSaveModal'));
  document.getElementById('cancelPresetSaveBtn').addEventListener('click', () => closeModal('presetSaveModal'));
  document.getElementById('confirmPresetSaveBtn').addEventListener('click', saveCurrentAsPreset);
  
  // Preset rename modal
  document.getElementById('closePresetRenameModal').addEventListener('click', () => closeModal('presetRenameModal'));
  document.getElementById('cancelPresetRenameBtn').addEventListener('click', () => closeModal('presetRenameModal'));
  document.getElementById('confirmPresetRenameBtn').addEventListener('click', confirmRenamePreset);
  
  // Confirm modal
  document.getElementById('closeConfirmModal').addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirmModal');
  });
  
  document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirmModal');
  });
  
  document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
    closeModal('confirmModal');
  });
  
  // Preset section collapse
  elements.presetHeader.addEventListener('click', () => {
    elements.presetContent.classList.toggle('collapsed');
    const icon = elements.presetHeader.querySelector('.collapse-icon');
    icon.textContent = elements.presetContent.classList.contains('collapsed') ? '▶' : '▼';
  });
  
  // Welcome modal
  document.getElementById('getStartedBtn').addEventListener('click', handleGetStarted);
  
  // Close modals on overlay click
  [elements.cookieModal, elements.importModal, elements.exportModal, 
   elements.presetSaveModal, elements.presetRenameModal, elements.confirmModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
  
  // Export encryption toggle
  document.getElementById('exportEncrypted').addEventListener('change', async (e) => {
    if (elements.exportModal.style.display === 'flex') {
      await exportCurrentCookies();
    }
  });
}

// ==================== CSS for Toast Animations ====================

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .modal-overlay {
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .modal-overlay.active {
    opacity: 1;
  }
  
  .modal {
    transform: scale(0.9);
    transition: transform 0.3s ease;
  }
  
  .modal-overlay.active .modal {
    transform: scale(1);
  }
  
  .cookie-card {
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .preset-content.collapsed {
    display: none;
  }
  
  .collapse-icon {
    transition: transform 0.3s ease;
  }
`;
document.head.appendChild(style);
