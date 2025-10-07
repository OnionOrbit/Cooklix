/**
 * Cryptographic utilities for Cookie Manager Pro
 * Provides AES-256-GCM encryption/decryption for secure cookie storage
 */

/**
 * Generates a cryptographically secure 32-character random string
 * Uses base64 encoding to produce exactly 32 characters from 24 random bytes
 * @returns {string} A random 32-character string suitable for encryption key
 */
function generateEncryptionKey() {
  const array = new Uint8Array(24); // 24 bytes → 32 base64 characters
  crypto.getRandomValues(array);
  
  // Convert to base64 (24 bytes = 32 base64 chars)
  const base64 = btoa(String.fromCharCode.apply(null, array));
  
  // Remove any trailing padding to ensure exactly 32 characters
  return base64.replace(/=+$/, '');
}

/**
 * Retrieves existing encryption key from chrome.storage.local or generates a new one
 * Validates that the key is exactly 32 characters; regenerates if invalid
 * @returns {Promise<string>} The encryption key (exactly 32 characters)
 * @throws {Error} If unable to access chrome.storage
 */
async function getOrCreateKey() {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['masterEncryptionKey'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to retrieve encryption key: ${chrome.runtime.lastError.message}`));
          return;
        }

        // Validate existing key or generate new one
        if (result.masterEncryptionKey && result.masterEncryptionKey.length === 32) {
          resolve(result.masterEncryptionKey);
        } else {
          // Generate new key if none exists or if invalid length
          const newKey = generateEncryptionKey();
          
          // Verify the generated key is exactly 32 characters
          if (newKey.length !== 32) {
            reject(new Error(`Generated key has invalid length: ${newKey.length} (expected 32)`));
            return;
          }
          
          chrome.storage.local.set({ masterEncryptionKey: newKey }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Failed to store encryption key: ${chrome.runtime.lastError.message}`));
              return;
            }
            resolve(newKey);
          });
        }
      });
    });
  } catch (error) {
    throw new Error(`Error in getOrCreateKey: ${error.message}`);
  }
}

/**
 * Converts a 32-character string to a CryptoKey using PBKDF2 key derivation
 * @param {string} keyString - 32-character string to derive key from
 * @returns {Promise<CryptoKey>} CryptoKey suitable for AES-256-GCM
 * @private
 */
async function stringToCryptoKey(keyString) {
  // Use PBKDF2 to derive a 256-bit key from the 32-character string
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(keyString);
  
  // Import the key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Fixed salt for deterministic key derivation (since our input is already random)
  const salt = encoder.encode('CookieManagerPro-AES-Salt');
  
  // Derive the AES-GCM key
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-256-GCM
 * @param {any} data - Any JSON-serializable data to encrypt
 * @returns {Promise<string>} Base64 encoded encrypted string with IV prepended
 * @throws {Error} If encryption fails
 */
async function encrypt(data) {
  try {
    const key = await getOrCreateKey();
    const cryptoKey = await stringToCryptoKey(key);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataString);
    
    const encryptedBytes = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      dataBytes
    );
    
    const combinedBytes = new Uint8Array(iv.length + encryptedBytes.byteLength);
    combinedBytes.set(iv, 0);
    combinedBytes.set(new Uint8Array(encryptedBytes), iv.length);
    
    return btoa(String.fromCharCode.apply(null, combinedBytes));
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts data using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted string with IV prepended
 * @returns {Promise<any>} Original decrypted data
 * @throws {Error} If decryption fails
 */
async function decrypt(encryptedData) {
  try {
    const key = await getOrCreateKey();
    const cryptoKey = await stringToCryptoKey(key);
    
    const combinedBytes = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    const iv = combinedBytes.slice(0, 12);
    const encryptedBytes = combinedBytes.slice(12);
    
    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encryptedBytes
    );
    
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBytes);
    
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypts a JSON object
 * @param {Object} jsonData - JSON object to encrypt
 * @returns {Promise<string>} Base64 encoded encrypted string
 * @throws {Error} If encryption fails or data is not JSON-serializable
 */
async function encryptJSON(jsonData) {
  if (typeof jsonData !== 'object' || jsonData === null) {
    throw new Error('encryptJSON requires a valid JSON object');
  }
  
  try {
    JSON.stringify(jsonData);
  } catch (error) {
    throw new Error(`Data is not JSON-serializable: ${error.message}`);
  }
  
  return await encrypt(jsonData);
}

/**
 * Decrypts a string back to a JSON object
 * @param {string} encryptedString - Base64 encoded encrypted string
 * @returns {Promise<Object>} Decrypted JSON object
 * @throws {Error} If decryption fails or result is not a valid JSON object
 */
async function decryptJSON(encryptedString) {
  if (typeof encryptedString !== 'string') {
    throw new Error('decryptJSON requires a string input');
  }
  
  const decryptedData = await decrypt(encryptedString);
  
  if (typeof decryptedData !== 'object' || decryptedData === null) {
    throw new Error('Decrypted data is not a valid JSON object');
  }
  
  return decryptedData;
}

// Make functions available globally for importScripts compatibility
if (typeof self !== 'undefined') {
  self.generateEncryptionKey = generateEncryptionKey;
  self.getOrCreateKey = getOrCreateKey;
  self.encrypt = encrypt;
  self.decrypt = decrypt;
  self.encryptJSON = encryptJSON;
  self.decryptJSON = decryptJSON;
}
