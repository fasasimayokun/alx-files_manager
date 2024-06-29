import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import userUtils from '../utils/user';

class AuthController {
  /**
   * this will sign-in the user by generating a new authentication token
   *
   * By using the header Authorization and the technique of the Basic auth
   * If no user has been found, return an error Unauthorized with a status code 401
   * else:
   * Generate a random string (using uuidv4) as token
   * Create a key: auth_<token>
   * Use this key for storing in Redis (by using the redisClient create previously)
   * the user ID for 24 hours
   * with a status code 200
   */
  static async getConnect(request, response) {
    const Authorization = request.header('Authorization') || '';

    const credentials = Authorization.split(' ')[1];

    if (!credentials) { return response.status(401).send({ error: 'Unauthorized' }); }

    const decodedCredentials = Buffer.from(credentials, 'base64').toString(
      'utf-8',
    );

    const [email, password] = decodedCredentials.split(':');

    if (!email || !password) { return response.status(401).send({ error: 'Unauthorized' }); }

    const sha1Password = sha1(password);

    const user = await userUtils.getUser({
      email,
      password: sha1Password,
    });

    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    const token = uuidv4();
    const key = `auth_${token}`;
    const hoursForExpiration = 24;

    await redisClient.set(key, user._id.toString(), hoursForExpiration * 3600);

    return response.status(200).send({ token });
  }

  /**
   * this will sign-out the user based on the token
   * Retrieve the user based on the token:
   * If not found, return an error Unauthorized with a status code 401
   * else, delete the token in Redis and return nothing with a
   * status code 204
   */
  static async getDisconnect(request, response) {
    const { userId, key } = await userUtils.getUserIdAndKey(request);

    if (!userId) return response.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(key);

    return response.status(204).send();
  }
}

export default AuthController;
