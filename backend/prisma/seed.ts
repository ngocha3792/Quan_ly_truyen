import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const permissions = [
    [
        'author-application.create',
        'Create own author application',
        'author-application',
        'create',
    ],

    [
        'author-application.read.own',
        'Read own author application',
        'author-application',
        'read.own',
    ],

    [
        'author-application.review',
        'Review author applications',
        'author-application',
        'review',
    ],
    ['author.read', 'Read author lifecycle administration', 'author', 'read'],
    ['author.status.manage', 'Manage author lifecycle status', 'author', 'status.manage'],
    ["user.profile.read", "Read own profile", "user.profile", "read"],
    ["user.profile.update", "Update own profile", "user.profile", "update"],
    ["user.security.read", "Read own security settings", "user.security", "read"],
    ["user.security.manage", "Manage own security settings", "user.security", "manage"],
    ["user.account.delete", "Request deletion of own account", "user.account", "delete"],
    ["user.manage", "Manage users", "user", "manage"],
    ["role.manage", "Manage roles and permissions", "role", "manage"],

    ["story.read", "Read published stories", "story", "read"],
    ["story.create", "Create stories", "story", "create"],
    ["story.update.own", "Update own stories", "story", "update.own"],
    ["story.delete.own", "Delete own stories", "story", "delete.own"],
    ["story.submit", "Submit stories for review", "story", "submit"],
    ["story.review", "Review submitted stories", "story", "review"],
    ["story.publish", "Publish stories", "story", "publish"],
    ["story.update.any", "Update any story", "story", "update.any"],
    ["story.delete.any", "Delete any story", "story", "delete.any"],

    ["chapter.create", "Create chapters", "chapter", "create"],
    ["chapter.update.own", "Update chapters of own stories", "chapter", "update.own"],
    ["chapter.delete.own", "Delete chapters of own stories", "chapter", "delete.own"],
    ["chapter.publish.own", "Publish chapters of own stories", "chapter", "publish.own"],
    ["chapter.manage.any", "Manage any chapter", "chapter", "manage.any"],

    ["comment.create", "Create comments", "comment", "create"],
    ["comment.update.own", "Update own comments", "comment", "update.own"],
    ["comment.delete.own", "Delete own comments", "comment", "delete.own"],
    ["comment.moderate", "Moderate comments", "comment", "moderate"],

    ["rating.create", "Rate stories", "rating", "create"],
    ["rating.update.own", "Update own ratings", "rating", "update.own"],
    ["library.manage.own", "Manage own reading library", "library", "manage.own"],
    ["follow.manage.own", "Manage own story follows", "follow", "manage.own"],
    ["reading-history.manage.own", "Manage own reading history", "reading-history", "manage.own"],
    ["reading-bookmark.manage.own", "Manage own reading bookmarks", "reading-bookmark", "manage.own"],
    ["reading-goal.manage.own", "Manage own reading goal", "reading-goal", "manage.own"],

    ["report.create", "Create reports", "report", "create"],
    ["report.review", "Review and resolve reports", "report", "review"],
    ["moderation.execute", "Execute moderation actions", "moderation", "execute"],

    ["category.manage", "Manage categories", "category", "manage"],
    ["tag.manage", "Manage tags", "tag", "manage"],
    ["media.upload", "Upload media", "media", "upload"],
    ["media.manage.any", "Manage any media", "media", "manage.any"],
    ["notification.manage.own", "Manage own notifications", "notification", "manage.own"],
    ["audit-log.read", "Read audit logs", "audit-log", "read"],
    ["analytics.read", "Read analytics", "analytics", "read"],
] as const;

type PermissionCode = (typeof permissions)[number][0];

const userPermissionCodes: PermissionCode[] = [
    "user.profile.read",
    "user.profile.update",
    "user.security.read",
    'author-application.create',
    'author-application.read.own',
    "user.security.manage",
    "user.account.delete",
    "story.read",
    "comment.create",
    "comment.update.own",
    "comment.delete.own",
    "rating.create",
    "rating.update.own",
    "library.manage.own",
    "follow.manage.own",
    "reading-history.manage.own",
    "reading-bookmark.manage.own",
    "reading-goal.manage.own",
    "report.create",
    "media.upload",
    "notification.manage.own",
];

const securityQuestions = [
    ["childhood_nickname", "Biệt danh thời thơ ấu của bạn là gì?", 10],
    ["first_school", "Tên trường tiểu học đầu tiên của bạn là gì?", 20],
    ["first_teacher", "Tên giáo viên đầu tiên của bạn là gì?", 30],
    ["childhood_friend", "Tên người bạn thân thời thơ ấu của bạn là gì?", 40],
    ["favorite_childhood_book", "Cuốn sách yêu thích thời thơ ấu của bạn là gì?", 50],
    ["first_pet", "Tên thú cưng đầu tiên của bạn là gì?", 60],
    ["parents_meeting_city", "Cha mẹ bạn gặp nhau lần đầu ở thành phố nào?", 70],
    ["memorable_place", "Địa điểm đáng nhớ nhất trong tuổi thơ của bạn là gì?", 80],
] as const;

const authorPermissionCodes: PermissionCode[] = [
    ...userPermissionCodes,
    "story.create",
    "story.update.own",
    "story.delete.own",
    "story.submit",
    "chapter.create",
    "chapter.update.own",
    "chapter.delete.own",
    "chapter.publish.own",
    "analytics.read",
];

async function upsertRole(code: string, name: string, description: string) {
    return prisma.role.upsert({
        where: { code },
        update: { name, description, isSystem: true },
        create: { code, name, description, isSystem: true },
    });
}

async function main() {
    const permissionRows = new Map<string, { id: string }>();

    for (const [code, name, resource, action] of permissions) {
        const row = await prisma.permission.upsert({
            where: { code },
            update: { name, resource, action },
            create: { code, name, resource, action },
            select: { id: true },
        });

        permissionRows.set(code, row);
    }

    const roles = {
        USER: await upsertRole(
            "USER",
            "User",
            "Authenticated reader with profile, library, rating, comment and follow permissions",
        ),
        AUTHOR: await upsertRole(
            "AUTHOR",
            "Author",
            "Creator who inherits reader capabilities and can manage owned stories and chapters",
        ),
        ADMIN: await upsertRole(
            "ADMIN",
            "Administrator",
            "System administrator with every permission",
        ),
    };

    const roleMappings: Array<[string, PermissionCode[]]> = [
        [roles.USER.id, userPermissionCodes],
        [roles.AUTHOR.id, authorPermissionCodes],
        [roles.ADMIN.id, permissions.map(([code]) => code)],
    ];

    for (const [roleId, codes] of roleMappings) {
        await prisma.rolePermission.createMany({
            data: codes.map((code) => ({
                roleId,
                permissionId: permissionRows.get(code)!.id,
            })),
            skipDuplicates: true,
        });
    }

    for (const [code, label, sortOrder] of securityQuestions) {
        await prisma.securityQuestion.upsert({
            where: { code },
            update: { label, locale: "vi", sortOrder, isActive: true },
            create: { code, label, locale: "vi", sortOrder, isActive: true },
        });
    }

    console.log(
        `Seeded ${permissions.length} permissions, ${Object.keys(roles).length} system roles and ${securityQuestions.length} security questions`,
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
