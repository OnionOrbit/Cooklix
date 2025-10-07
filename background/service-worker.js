/**
 * Background Service Worker for Cookie Manager Pro
 * Handles all cookie operations and encrypted storage
 */

// Import crypto utilities (service workers use importScripts, not ES6 imports)
importScripts('../lib/crypto.js');

/**
 * Helper function to construct URL from domain and protocol
 * @param {string} domain - Domain name (can include leading dot)
 * @param {boolean} secure - Whether to use https
 * @returns {string} Full URL
 */
function constructUrl(domain, secure = false) {
  const protocol = secure ? 'https://' : 'http://';
  const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  return protocol + cleanDomain;
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url;
  }
}

/**
 * Get all cookies for a domain
 * @param {string} domain - Domain to filter by (optional)
 * @returns {Promise<Array>} Array of cookies
 */
async function getCookies(domain) {
  try {
    const query = domain ? { domain } : {};
    const cookies = await chrome.cookies.getAll(query);
    return { success: true, cookies };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Set or update a cookie
 * @param {Object} cookieDetails - Cookie details
 * @returns {Promise<Object>} Success status
 */
async function setCookie(cookieDetails) {
  try {
    if (!cookieDetails.url && !cookieDetails.domain) {
      throw new Error('Either url or domain must be provided');
    }

    const url = cookieDetails.url || constructUrl(cookieDetails.domain, cookieDetails.secure);
    
    const cookieConfig = {
      url,
      name: cookieDetails.name,
      value: cookieDetails.value,
    };

    if (cookieDetails.domain) cookieConfig.domain = cookieDetails.domain;
    if (cookieDetails.path) cookieConfig.path = cookieDetails.path;
    if (cookieDetails.secure !== undefined) cookieConfig.secure = cookieDetails.secure;
    if (cookieDetails.httpOnly !== undefined) cookieConfig.httpOnly = cookieDetails.httpOnly;
    if (cookieDetails.expirationDate) cookieConfig.expirationDate = cookieDetails.expirationDate;
    if (cookieDetails.sameSite) cookieConfig.sameSite = cookieDetails.sameSite;

    const cookie = await chrome.cookies.set(cookieConfig);
    return { success: true, cookie };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a cookie
 * @param {Object} cookieDetails - Cookie details (url, name)
 * @returns {Promise<Object>} Success status
 */
async function deleteCookie(cookieDetails) {
  try {
    if (!cookieDetails.url || !cookieDetails.name) {
      throw new Error('Both url and name are required');
    }

    const details = await chrome.cookies.remove({
      url: cookieDetails.url,
      name: cookieDetails.name
    });

    return { success: true, details };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get the domain of the current active tab
 * @returns {Promise<Object>} Domain string
 */
async function getCurrentTabDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error('No active tab found');
    }

    const domain = extractDomain(tab.url);
    return { success: true, domain };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save cookies as an encrypted preset
 * @param {string} presetName - Name of the preset
 * @param {Array} cookies - Array of cookies to save
 * @returns {Promise<Object>} Success status
 */
async function savePreset(presetName, cookies) {
  try {
    if (!presetName || !presetName.trim()) {
      throw new Error('Preset name is required');
    }

    if (!Array.isArray(cookies)) {
      throw new Error('Cookies must be an array');
    }

    const encryptedData = await encryptJSON(cookies);
    
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};
    presets[presetName] = encryptedData;
    
    await chrome.storage.local.set({ presets });
    
    return { success: true, presetName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Load and decrypt a preset
 * @param {string} presetName - Name of the preset
 * @returns {Promise<Object>} Decrypted cookies
 */
async function loadPreset(presetName) {
  try {
    if (!presetName) {
      throw new Error('Preset name is required');
    }

    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};
    
    if (!presets[presetName]) {
      throw new Error(`Preset "${presetName}" not found`);
    }

    const cookies = await decryptJSON(presets[presetName]);
    
    return { success: true, cookies };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get list of all preset names
 * @returns {Promise<Object>} Array of preset names
 */
async function getPresets() {
  try {
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};
    const presetNames = Object.keys(presets);
    
    return { success: true, presets: presetNames };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a preset
 * @param {string} presetName - Name of the preset to delete
 * @returns {Promise<Object>} Success status
 */
async function deletePreset(presetName) {
  try {
    if (!presetName) {
      throw new Error('Preset name is required');
    }

    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};
    
    if (!presets[presetName]) {
      throw new Error(`Preset "${presetName}" not found`);
    }

    delete presets[presetName];
    await chrome.storage.local.set({ presets });
    
    return { success: true, presetName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Rename a preset
 * @param {string} oldName - Current name of the preset
 * @param {string} newName - New name for the preset
 * @returns {Promise<Object>} Success status
 */
async function renamePreset(oldName, newName) {
  try {
    if (!oldName || !newName) {
      throw new Error('Both old and new names are required');
    }

    if (oldName === newName) {
      throw new Error('New name must be different from old name');
    }

    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};
    
    if (!presets[oldName]) {
      throw new Error(`Preset "${oldName}" not found`);
    }

    if (presets[newName]) {
      throw new Error(`Preset "${newName}" already exists`);
    }

    presets[newName] = presets[oldName];
    delete presets[oldName];
    
    await chrome.storage.local.set({ presets });
    
    return { success: true, oldName, newName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Load preset and apply cookies to a domain
 * @param {string} presetName - Name of the preset
 * @param {string} domain - Target domain
 * @returns {Promise<Object>} Success status with count
 */
async function applyPreset(presetName, domain) {
  try {
    if (!presetName) {
      throw new Error('Preset name is required');
    }

    if (!domain) {
      throw new Error('Domain is required');
    }

    const loadResult = await loadPreset(presetName);
    if (!loadResult.success) {
      throw new Error(loadResult.error);
    }

    const cookies = loadResult.cookies;
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const cookie of cookies) {
      const cookieDetails = {
        ...cookie,
        domain,
        url: constructUrl(domain, cookie.secure)
      };

      const result = await setCookie(cookieDetails);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        errors.push({ name: cookie.name, error: result.error });
      }
    }

    return { 
      success: true, 
      applied: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export cookies for a domain
 * @param {string} domain - Domain to export cookies from
 * @param {boolean} encrypted - Whether to encrypt the export
 * @returns {Promise<Object>} JSON string of cookies
 */
async function exportCookies(domain, encrypted = false) {
  try {
    const result = await getCookies(domain);
    if (!result.success) {
      throw new Error(result.error);
    }

    let exportData;
    if (encrypted) {
      exportData = await encryptJSON(result.cookies);
    } else {
      exportData = JSON.stringify(result.cookies, null, 2);
    }

    return { success: true, data: exportData, encrypted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import cookies from JSON data
 * @param {string} jsonData - JSON string or encrypted data
 * @param {boolean} encrypted - Whether the data is encrypted
 * @returns {Promise<Object>} Success status with count
 */
async function importCookies(jsonData, encrypted = false) {
  try {
    if (!jsonData) {
      throw new Error('JSON data is required');
    }

    let cookies;
    if (encrypted) {
      cookies = await decryptJSON(jsonData);
    } else {
      cookies = JSON.parse(jsonData);
    }

    if (!Array.isArray(cookies)) {
      throw new Error('Invalid cookie data: expected an array');
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const cookie of cookies) {
      const cookieDetails = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite === 'no_restriction' ? 'no_restriction' : 
                  (cookie.sameSite === 'lax' ? 'lax' : 
                  (cookie.sameSite === 'strict' ? 'strict' : undefined))
      };

      if (cookie.expirationDate && !cookie.session) {
        cookieDetails.expirationDate = cookie.expirationDate;
      }

      cookieDetails.url = constructUrl(cookie.domain, cookie.secure);

      const result = await setCookie(cookieDetails);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        errors.push({ name: cookie.name, error: result.error });
      }
    }

    return { 
      success: true, 
      imported: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Message handler for communication with popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      let response;

      switch (request.action) {
        case 'getCookies':
          response = await getCookies(request.domain);
          break;

        case 'setCookie':
          response = await setCookie(request.cookieDetails);
          break;

        case 'deleteCookie':
          response = await deleteCookie(request.cookieDetails);
          break;

        case 'getCurrentTabDomain':
          response = await getCurrentTabDomain();
          break;

        case 'savePreset':
          response = await savePreset(request.presetName, request.cookies);
          break;

        case 'loadPreset':
          response = await loadPreset(request.presetName);
          break;

        case 'getPresets':
          response = await getPresets();
          break;

        case 'deletePreset':
          response = await deletePreset(request.presetName);
          break;

        case 'renamePreset':
          response = await renamePreset(request.oldName, request.newName);
          break;

        case 'applyPreset':
          response = await applyPreset(request.presetName, request.domain);
          break;

        case 'exportCookies':
          response = await exportCookies(request.domain, request.encrypted);
          break;

        case 'importCookies':
          response = await importCookies(request.jsonData, request.encrypted);
          break;

        default:
          response = { success: false, error: `Unknown action: ${request.action}` };
      }

      sendResponse(response);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Cookie Manager Pro installed');
  } else if (details.reason === 'update') {
    console.log('Cookie Manager Pro updated to version', chrome.runtime.getManifest().version);
  }
});
