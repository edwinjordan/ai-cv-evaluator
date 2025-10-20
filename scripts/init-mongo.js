// MongoDB initialization script
db = db.getSiblingDB('cv_evaluation');

// Create application user
db.createUser({
  user: 'cv_app',
  pwd: 'cv_app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'cv_evaluation'
    }
  ]
});

// Create some initial collections
db.users.insertOne({
  name: "Test User",
  email: "test@example.com",
  role: "user",
  isEmailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Database cv_evaluation initialized successfully!');