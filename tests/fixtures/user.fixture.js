import mongoose from 'mongoose';
import { genSaltSync, hashSync } from 'bcryptjs';
import { faker } from '@faker-js/faker';
import User from '../../src/models/user.model.js';

const password = 'password1';
const salt = genSaltSync(8);
const hashedPassword = hashSync(password, salt);

const ids = {
  userOne: new mongoose.Types.ObjectId(),
  userTwo: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId()
};

const userOne = {
  _id: ids.userOne,
  name: faker.person.fullName(),
  address: faker.location.streetAddress(true),
  gender: 1,
  dateOfBirth: faker.date.past(),
  phoneNumber: faker.phone.number(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  isEmailVerified: false,
};

const userTwo = {
  _id: ids.userTwo,
  name: faker.person.fullName(),
  address: faker.location.streetAddress(true),
  gender: 0,
  dateOfBirth: faker.date.past(),
  phoneNumber: faker.phone.number(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  isEmailVerified: false,
};

const admin = {
  _id: ids.admin,
  name: faker.person.fullName(),
  address: faker.location.streetAddress(true),
  gender: 1,
  dateOfBirth: faker.date.past(),
  phoneNumber: faker.phone.number(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin',
  isEmailVerified: true,
};

const insertUsers = async (users) => {
  await User.insertMany(users.map((user) => ({ ...user, password: hashedPassword })));
};

export {
  userOne,
  userTwo,
  admin,
  insertUsers,
};