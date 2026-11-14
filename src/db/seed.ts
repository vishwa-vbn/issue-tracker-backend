import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { users, issues, comments, issueActivity } from './schema/index.js';
import { env } from '../config/env.js';
import { hashPassword } from '../lib/password.js';
import { logger } from '../config/logger.js';

export async function runSeed() {
  logger.info('Running database seed...');

  // 1. Seed Admin
  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));

  let adminId: string;
  if (existingAdmin.length === 0) {
    const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
    const [createdAdmin] = await db
      .insert(users)
      .values({
        name: env.ADMIN_NAME,
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      })
      .returning();
    adminId = createdAdmin!.id;
    logger.info({ adminEmail }, 'Admin user created successfully.');
  } else {
    adminId = existingAdmin[0]!.id;
    logger.info({ adminEmail }, 'Admin user already exists. Skipping creation.');
  }

  // 2. Demo data (if SEED_DEMO_DATA=true)
  if (env.SEED_DEMO_DATA) {
    logger.info('Seeding demo data...');

    // Demo regular user
    const demoEmail = 'demo.user@example.com';
    const existingDemo = await db.select().from(users).where(eq(users.email, demoEmail));

    let demoUserId: string;
    if (existingDemo.length === 0) {
      const demoHash = await hashPassword('Passw0rdOK');
      const [demoUser] = await db
        .insert(users)
        .values({
          name: 'Demo User',
          email: demoEmail,
          passwordHash: demoHash,
          role: 'USER',
          isActive: true,
        })
        .returning();
      demoUserId = demoUser!.id;
      logger.info({ demoEmail }, 'Demo user created.');
    } else {
      demoUserId = existingDemo[0]!.id;
    }

    // Check if issues exist
    const existingIssues = await db.select().from(issues);
    if (existingIssues.length === 0) {
      // Create initial sample issues
      const [issue1] = await db
        .insert(issues)
        .values({
          title: 'Login button unresponsive on Safari',
          description:
            'Users report that clicking the login button on iOS Safari does not submit the form.',
          status: 'OPEN',
          priority: 'HIGH',
          reporterId: demoUserId,
          assigneeId: adminId,
        })
        .returning();

      const [issue2] = await db
        .insert(issues)
        .values({
          title: 'Add dark mode toggle in navigation',
          description:
            'Implement a theme switch allowing users to toggle between dark and light themes.',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          reporterId: adminId,
          assigneeId: demoUserId,
        })
        .returning();

      const [issue3] = await db
        .insert(issues)
        .values({
          title: 'Database connection pool timeout under load',
          description:
            'During peak testing hours, connection pool warnings appear in the application logs.',
          status: 'CLOSED',
          priority: 'CRITICAL',
          reporterId: adminId,
          assigneeId: adminId,
          closedAt: new Date(),
        })
        .returning();

      // Activity for issue1
      if (issue1) {
        await db.insert(issueActivity).values({
          issueId: issue1.id,
          actorId: demoUserId,
          type: 'CREATED',
          toValue: 'OPEN',
        });
        await db.insert(issueActivity).values({
          issueId: issue1.id,
          actorId: demoUserId,
          type: 'ASSIGNED',
          toValue: env.ADMIN_NAME,
        });
        await db.insert(comments).values({
          issueId: issue1.id,
          authorId: adminId,
          body: 'Looking into this. Could you share the Safari version and iOS build?',
        });
      }

      // Activity for issue2
      if (issue2) {
        await db.insert(issueActivity).values({
          issueId: issue2.id,
          actorId: adminId,
          type: 'CREATED',
          toValue: 'OPEN',
        });
        await db.insert(issueActivity).values({
          issueId: issue2.id,
          actorId: adminId,
          type: 'STATUS_CHANGED',
          fromValue: 'OPEN',
          toValue: 'IN_PROGRESS',
        });
      }

      // Activity for issue3
      if (issue3) {
        await db.insert(issueActivity).values({
          issueId: issue3.id,
          actorId: adminId,
          type: 'CREATED',
          toValue: 'OPEN',
        });
        await db.insert(issueActivity).values({
          issueId: issue3.id,
          actorId: adminId,
          type: 'STATUS_CHANGED',
          fromValue: 'IN_PROGRESS',
          toValue: 'CLOSED',
        });
      }

      logger.info('Demo issues, comments and activities seeded successfully.');
    }
  }

  logger.info('Database seed complete.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, 'Seed failed');
      await pool.end();
      process.exit(1);
    });
}
