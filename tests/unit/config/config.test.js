import path from 'path';
import dotenv from 'dotenv';
import config from '../../../src/config/config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

describe('Config Environment', () => {
  describe('MongoDb Url', () => {
    config.env = 'test';

    test('should return local mongoose Url with test database', async () => {
      // Uncomment this line to explicitly set test environment
      expect(config.mongoose.url).toBe(`${process.env.MONGODB_URL_LOCAL}-test`);
    });

    test('should return local jwt secret', async () => {
      expect(config.jwt.secret).toBe(process.env.JWT_SECRET);
    });
  });

  // TODO: Tambahkan test untuk development dan production
});