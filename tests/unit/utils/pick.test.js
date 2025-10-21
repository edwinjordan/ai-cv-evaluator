import { faker } from '@faker-js/faker';
import pick from '../../../src/utils/pick';

describe('Config Environment', () => {
  describe('Pick Utils', () => {
    let newUser;
    beforeEach(() => {
      newUser = {
        name: faker.person.fullName(),
        address: faker.location.streetAddress(true),
        gender: 1,
        dateOfBirth: faker.date.past(),
        phoneNumber: faker.phone.number(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user',
      };
    });

    test('should return object composed of the picked object properties', async () => {
      expect(pick(newUser, ['name', 'address', 'gender', 'dateOfBirth', 'phoneNumber'])).toMatchObject({
        name: newUser.name,
        address: newUser.address,
        gender: newUser.gender,
        dateOfBirth: newUser.dateOfBirth,
        phoneNumber: newUser.phoneNumber,
      });
    });
  });

  // TODO: Tambahkan test untuk development dan production
});
