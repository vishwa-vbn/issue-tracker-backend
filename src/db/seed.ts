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
    logger.info('Seeding demo data (25+ simulated users & 25+ simulated issues)...');

    const defaultPasswordHash = await hashPassword('Passw0rdOK');

    // Demo regular user
    const demoEmail = 'demo.user@example.com';
    const existingDemo = await db.select().from(users).where(eq(users.email, demoEmail));

    let demoUserId: string;
    if (existingDemo.length === 0) {
      const [demoUser] = await db
        .insert(users)
        .values({
          name: 'Demo User',
          email: demoEmail,
          passwordHash: defaultPasswordHash,
          role: 'USER',
          isActive: true,
        })
        .returning();
      demoUserId = demoUser!.id;
    } else {
      demoUserId = existingDemo[0]!.id;
    }

    // 25 Simulated Users
    const simulatedUsersData = [
      { name: 'Aarav Patel', email: 'aarav.patel@example.com', role: 'USER' as const },
      { name: 'Priya Sharma', email: 'priya.sharma@example.com', role: 'USER' as const },
      { name: 'Rohan Gupta', email: 'rohan.gupta@example.com', role: 'USER' as const },
      { name: 'Ananya Iyer', email: 'ananya.iyer@example.com', role: 'USER' as const },
      { name: 'Vikram Malhotra', email: 'vikram.malhotra@example.com', role: 'USER' as const },
      { name: 'Sneha Reddy', email: 'sneha.reddy@example.com', role: 'USER' as const },
      { name: 'Arjun Nair', email: 'arjun.nair@example.com', role: 'USER' as const },
      { name: 'Divya Joshi', email: 'divya.joshi@example.com', role: 'USER' as const },
      { name: 'Rajesh Kumar', email: 'rajesh.kumar@example.com', role: 'USER' as const },
      { name: 'Neha Verma', email: 'neha.verma@example.com', role: 'USER' as const },
      { name: 'Michael Scott', email: 'michael.scott@example.com', role: 'ADMIN' as const },
      { name: 'Pam Beesly', email: 'pam.beesly@example.com', role: 'USER' as const },
      { name: 'Jim Halpert', email: 'jim.halpert@example.com', role: 'USER' as const },
      { name: 'Dwight Schrute', email: 'dwight.schrute@example.com', role: 'ADMIN' as const },
      { name: 'Angela Martin', email: 'angela.martin@example.com', role: 'USER' as const },
      { name: 'Oscar Martinez', email: 'oscar.martinez@example.com', role: 'USER' as const },
      { name: 'Kevin Malone', email: 'kevin.malone@example.com', role: 'USER' as const },
      { name: 'Stanley Hudson', email: 'stanley.hudson@example.com', role: 'USER' as const },
      { name: 'Toby Flenderson', email: 'toby.flenderson@example.com', role: 'USER' as const },
      { name: 'Kelly Kapoor', email: 'kelly.kapoor@example.com', role: 'USER' as const },
      { name: 'Ryan Howard', email: 'ryan.howard@example.com', role: 'USER' as const },
      { name: 'Meredith Palmer', email: 'meredith.palmer@example.com', role: 'USER' as const },
      { name: 'Creed Bratton', email: 'creed.bratton@example.com', role: 'USER' as const },
      { name: 'Phyllis Vance', email: 'phyllis.vance@example.com', role: 'USER' as const },
      { name: 'Darryl Philbin', email: 'darryl.philbin@example.com', role: 'USER' as const },
    ];

    const userIds: string[] = [adminId, demoUserId];

    for (const u of simulatedUsersData) {
      const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
      if (!existing) {
        const [newUser] = await db
          .insert(users)
          .values({
            name: u.name,
            email: u.email,
            passwordHash: defaultPasswordHash,
            role: u.role,
            isActive: true,
          })
          .returning();
        if (newUser) userIds.push(newUser.id);
      } else {
        userIds.push(existing.id);
      }
    }

    logger.info({ userCount: userIds.length }, 'Simulated users verified/seeded.');

    // 25+ Simulated Issues
    const simulatedIssuesData = [
      {
        title: 'Fix memory leak in websocket reconnection handler',
        description: 'Memory usage climbs continuously during network reconnection retries.',
        status: 'OPEN' as const,
        priority: 'HIGH' as const,
      },
      {
        title: 'Update dependencies to support Node 22 ESM',
        description: 'Upgrade build tools and packages to leverage native ECMAScript modules.',
        status: 'IN_PROGRESS' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Add CSV export feature for issue reports',
        description: 'Users should be able to export filtered issue lists directly into CSV format.',
        status: 'OPEN' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'User avatar upload crashes on Safari iOS',
        description: 'Selecting HEIC images from photo library fails silently on iOS 17 and 18.',
        status: 'OPEN' as const,
        priority: 'CRITICAL' as const,
      },
      {
        title: 'Implement rate limiting headers on public health endpoints',
        description: 'Return X-RateLimit headers consistently across ping and health probes.',
        status: 'CLOSED' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'Add keyboard shortcuts (Ctrl+K) for issue search',
        description: 'Global command palette to search issues and navigate between pages.',
        status: 'IN_PROGRESS' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Audit log missing for role elevation events',
        description: 'Admin actions changing user permissions must produce an audit trail entry.',
        status: 'OPEN' as const,
        priority: 'HIGH' as const,
      },
      {
        title: 'Fix timezone offset in activity timeline timestamps',
        description: 'Timestamps in comments and activity log display UTC instead of local timezone.',
        status: 'CLOSED' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Optimize database query on issue list with 50+ items',
        description: 'Explain analyze indicates sequential scan when filtering by assignee.',
        status: 'IN_PROGRESS' as const,
        priority: 'CRITICAL' as const,
      },
      {
        title: 'Email notification template broken on Outlook desktop',
        description: 'Table borders collapse unpredictably on Windows desktop Outlook client.',
        status: 'OPEN' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'Add multi-select bulk status update on admin table',
        description: 'Allow changing status of multiple selected issues in one batch action.',
        status: 'OPEN' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Fix race condition in concurrent comment creation',
        description: 'Rapid sequential submissions result in duplicate comment entries.',
        status: 'CLOSED' as const,
        priority: 'HIGH' as const,
      },
      {
        title: 'Add toggle for collapsed sidebar state in responsive view',
        description: 'Sidebar should remember user preferred collapsed or expanded state.',
        status: 'IN_PROGRESS' as const,
        priority: 'LOW' as const,
      },
      {
        title: '404 page redirecting to login when already authenticated',
        description: 'Unknown routes should display not found page without terminating session.',
        status: 'CLOSED' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Improve password strength meter accuracy',
        description: 'Zxcvbn score calculation sometimes disagrees with server Zod regex validation.',
        status: 'OPEN' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'Fix pagination total pages calculation on filtered query',
        description: 'Meta totalPages is calculated incorrectly when total matches safeLimit exactly.',
        status: 'CLOSED' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Support Markdown preview in issue description editor',
        description: 'Split screen preview rendering GitHub Flavored Markdown for formatting.',
        status: 'IN_PROGRESS' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Add filter for unassigned issues in dashboard widget',
        description: 'Allow clicking unassigned metrics card to navigate directly to filtered list.',
        status: 'CLOSED' as const,
        priority: 'HIGH' as const,
      },
      {
        title: 'Session expires too quickly when idle for 10 minutes',
        description: 'Token refresh interceptor should proactively refresh access tokens at 12 minutes.',
        status: 'OPEN' as const,
        priority: 'HIGH' as const,
      },
      {
        title: 'Fix horizontal scrollbar on mobile table view',
        description: 'Table columns cause container overflow on screen widths below 380px.',
        status: 'OPEN' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Prevent duplicate form submissions on double click',
        description: 'Disable submit button and display spinner while mutation is pending.',
        status: 'CLOSED' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'Add priority badge color indicators for CRITICAL items',
        description: 'Critical items should have prominent red badge styling in list and detail view.',
        status: 'CLOSED' as const,
        priority: 'CRITICAL' as const,
      },
      {
        title: 'Fix missing index on issue comments created_at column',
        description: 'Performance degradation when comments table reaches 10,000+ records.',
        status: 'OPEN' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Implement breadcrumbs navigation on issue detail page',
        description: 'Display navigation path: Dashboard > Issues > Issue #12 for better UX.',
        status: 'OPEN' as const,
        priority: 'LOW' as const,
      },
      {
        title: 'Add confirmation modal before permanently deleting comment',
        description: 'Prevent accidental deletions with alert dialog confirmation.',
        status: 'IN_PROGRESS' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Support sorting issues by title and issue number',
        description: 'Add title and issueNumber options to the sort dropdown in issue table.',
        status: 'CLOSED' as const,
        priority: 'MEDIUM' as const,
      },
      {
        title: 'Fix CORS preflight response headers on local development',
        description: 'Allow custom x-request-id and authorization headers in OPTIONS response.',
        status: 'CLOSED' as const,
        priority: 'HIGH' as const,
      },
    ];

    let insertedIssuesCount = 0;
    for (let i = 0; i < simulatedIssuesData.length; i++) {
      const issueItem = simulatedIssuesData[i]!;
      const existing = await db
        .select()
        .from(issues)
        .where(eq(issues.title, issueItem.title))
        .limit(1);

      if (existing.length === 0) {
        // Distribute reporters and assignees across simulated users
        const reporterId = userIds[(i + 1) % userIds.length]!;
        // Some issues remain unassigned (assigneeId: null)
        const isUnassigned = i % 4 === 0;
        const assigneeId = isUnassigned ? null : userIds[(i + 2) % userIds.length]!;

        const [created] = await db
          .insert(issues)
          .values({
            title: issueItem.title,
            description: issueItem.description,
            status: issueItem.status,
            priority: issueItem.priority,
            reporterId,
            assigneeId,
            closedAt: issueItem.status === 'CLOSED' ? new Date() : null,
          })
          .returning();

        if (created) {
          insertedIssuesCount++;
          // Add created activity
          await db.insert(issueActivity).values({
            issueId: created.id,
            actorId: reporterId,
            type: 'CREATED',
            toValue: 'OPEN',
          });

          if (assigneeId) {
            await db.insert(issueActivity).values({
              issueId: created.id,
              actorId: reporterId,
              type: 'ASSIGNED',
              toValue: 'Assigned User',
            });
          }

          if (issueItem.status === 'CLOSED') {
            await db.insert(issueActivity).values({
              issueId: created.id,
              actorId: reporterId,
              type: 'STATUS_CHANGED',
              fromValue: 'OPEN',
              toValue: 'CLOSED',
            });
          }

          // Add a sample comment to some issues
          if (i % 2 === 0) {
            await db.insert(comments).values({
              issueId: created.id,
              authorId: reporterId,
              body: `Initial analysis completed for "${issueItem.title}". Reviewing steps to reproduce.`,
            });
          }
        }
      }
    }

    logger.info(
      { insertedIssuesCount, totalSimulated: simulatedIssuesData.length },
      'Simulated issues seeded successfully.',
    );
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
