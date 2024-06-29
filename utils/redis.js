import redis from 'redis';
import { promisify } from 'util';

/**
 * the class for performing operations with Redis service
 */
class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.getAsync = promisify(this.client.get).bind(this.client);

    this.client.on('error', (error) => {
      console.log(`Redis client not connected to the server: ${error.message}`);
    });

    this.client.on('connect', () => {
      // console.log('Redis client connected to the server');
    });
  }

  /**
   * this method checks if connection to Redis is Alive
   * @return {boolean} true if connection alive else false
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * this gets value corresponding to key in redis
   * @key {string} key to get in redis
   * @return {string} value of key
   */
  async get(key) {
    const value = await this.getAsync(key);
    return value;
  }
  
  /**
   * this creates a new key in redis with a specific TTL
   * @key {string} key to be saved in redis
   * @value {string} value to be asigned to key
   * @duration {number} TTL of key
   * @return {undefined} return undefined
   */
  async set(key, value, duration) {
    this.client.setex(key, duration, value);
  }

  /**
   * this deletes the key in redis service
   * @key {string}the key to be deleted
   * @return {undefined} returns undefined
   */
  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();

export default redisClient;
