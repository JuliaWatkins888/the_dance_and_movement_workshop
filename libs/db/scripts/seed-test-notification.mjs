import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error(
    'MONGO_URI is not set. Run with: node --env-file=.env libs/db/scripts/seed-test-notification.mjs (from templates/core)'
  );
  process.exit(1);
}

const TEST_USER_ID = '6a9096997938f98e068faeba';

const notification = {
  userId: TEST_USER_ID,
  type: 'system:docs',
  title: 'Welcome to Inithium',
  body: 'Check out the documentation to get started.',
  actionUrl: '/docs',
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

await mongoose.connect(MONGO_URI);
await mongoose.connection.collection('notifications').insertOne(notification);
console.log(`Seeded 1 notification for user ${TEST_USER_ID}`);
await mongoose.disconnect();
