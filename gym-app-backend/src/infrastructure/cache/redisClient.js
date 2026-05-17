const { createClient } = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
  }

  getUrl() {
    if (process.env.REDIS_URL) {
      return process.env.REDIS_URL;
    }

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;

    if (password) {
      return `redis://:${password}@${host}:${port}`;
    }

    return `redis://${host}:${port}`;
  }

  async connect() {
    if (!this.isEnabled) {
      return;
    }

    if (this.client?.isOpen) {
      return;
    }

    this.client = createClient({
      url: this.getUrl(),
      socket: {
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
      },
    });

    this.client.on('error', (error) => {
      console.error('Redis error:', error.message);
    });

    await this.client.connect();
  }

  async disconnect() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  isReady() {
    return Boolean(this.client?.isReady);
  }

  async get(key) {
    if (!this.client?.isReady) return null;
    return this.client.get(key);
  }

  async setWithTtl(key, value, ttlSeconds) {
    if (!this.client?.isReady) return;
    await this.client.set(key, value, { EX: ttlSeconds });
  }
}

module.exports = new RedisClient();
