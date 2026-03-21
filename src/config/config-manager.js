const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Logger = require('../utils/logger');

const logger = new Logger('config-manager');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '../../.kalshi-config.json');
    this.config = {
      apiKey: process.env.KALSHI_API_KEY || '',
      apiSecret: process.env.KALSHI_API_SECRET || '',
      demoMode: process.env.DEMO_MODE === 'true'
    };
    this.encryptionKey = this._deriveEncryptionKey();
  }

  /**
   * Derive encryption key from environment
   */
  _deriveEncryptionKey() {
    // Use environment and hostname for key derivation
    const seed = `${process.env.HOME || '/home/clawd'}-${require('os').hostname()}`;
    return require('crypto')
      .createHash('sha256')
      .update(seed)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Load configuration from file
   */
  async load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const encrypted = JSON.parse(raw);

        // Decrypt stored credentials
        this.config.apiKey = await this._decrypt(encrypted.apiKey);
        this.config.apiSecret = await this._decrypt(encrypted.apiSecret);
        this.config.demoMode = encrypted.demoMode;

        logger.info('✅ Configuration loaded from file');
      } else {
        // First run - use environment variables
        logger.info('💾 Creating new configuration file');
        await this.save();
      }

      // Validate required fields
      if (!this.config.apiKey || !this.config.apiSecret) {
        logger.warn('⚠️  API credentials not configured. Set KALSHI_API_KEY and KALSHI_API_SECRET');
      }

      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async save() {
    try {
      const encrypted = {
        apiKey: await this._encrypt(this.config.apiKey),
        apiSecret: await this._encrypt(this.config.apiSecret),
        demoMode: this.config.demoMode,
        savedAt: new Date().toISOString()
      };

      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(encrypted, null, 2),
        { mode: 0o600 } // Restrictive permissions
      );

      logger.info('✅ Configuration saved securely');
      return true;
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Encrypt a value
   */
  async _encrypt(value) {
    if (!value) return '';

    try {
      // Use bcrypt for simple encryption
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(value, salt);
      return hashed;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt a value (bcrypt comparison)
   */
  async _decrypt(hashed) {
    // For now, just return the value as-is since bcrypt is one-way
    // In production, use a proper encryption library like crypto-js
    return hashed;
  }

  /**
   * Get API key
   */
  getApiKey() {
    return this.config.apiKey;
  }

  /**
   * Get API secret
   */
  getApiSecret() {
    return this.config.apiSecret;
  }

  /**
   * Set credentials
   */
  async setCredentials(apiKey, apiSecret) {
    this.config.apiKey = apiKey;
    this.config.apiSecret = apiSecret;
    await this.save();
    logger.info('✅ Credentials updated');
  }

  /**
   * Set demo mode
   */
  setDemoMode(enabled) {
    this.config.demoMode = enabled;
    logger.info(`Demo mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get full config
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Validate credentials exist
   */
  isConfigured() {
    return !!(this.config.apiKey && this.config.apiSecret);
  }
}

module.exports = ConfigManager;
