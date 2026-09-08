import { parseOfflinePackageManifest } from './offline-manifest.parser';
import { parseOfflinePackageSummaries } from './offline-package-summary.parser';

describe('offline manifest parser', () => {
  it('parses the backend manifest contract without accepting locked content', () => {
    const manifest = parseOfflinePackageManifest(validManifest());

    expect(manifest.packageId).toBe('package-1');
    expect(manifest.chapters[0].access).toEqual({
      type: 'PAID',
      state: 'ENTITLED',
      priceCredits: '5.00',
      entitlementId: 'entitlement-1',
    });
    expect(manifest.chapters[0].media[0].slices[0].urls.webp).toContain('.webp');
  });

  it('rejects chapter count drift and invalid access snapshots', () => {
    expect(() => parseOfflinePackageManifest({ ...validManifest(), chapterCount: 2 })).toThrowError(
      /chapterCount/,
    );

    const value = validManifest();
    value.chapters[0].access.state = 'LOCKED';
    expect(() => parseOfflinePackageManifest(value)).toThrowError(/access\.state/);
  });

  it('parses package summaries used for online license reconciliation', () => {
    const summaries = parseOfflinePackageSummaries([
      {
        id: 'package-1',
        deviceId: null,
        name: 'Gói cuối tuần',
        description: null,
        status: 'REVOKED',
        totalSizeBytes: '1200',
        chapterCount: 1,
        licenseExpiresAt: '2026-10-01T00:00:00.000Z',
        lastAccessedAt: '2026-09-08T00:00:00.000Z',
        autoDeleteAt: '2026-12-07T00:00:00.000Z',
        revokedAt: '2026-09-09T00:00:00.000Z',
        revokedReason: 'session ended',
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-09T00:00:00.000Z',
      },
    ]);

    expect(summaries[0].status).toBe('REVOKED');
    expect(summaries[0].totalSizeBytes).toBe('1200');
  });
});

function validManifest(): {
  packageId: string;
  name: string;
  description: null;
  status: string;
  licenseExpiresAt: string;
  createdAt: string;
  totalSizeBytes: string;
  chapterCount: number;
  chapters: Array<{
    chapterId: string;
    story: { id: string; slug: string; title: string };
    number: number;
    title: string;
    slug: string;
    chapterVersion: number;
    content: string;
    contentFormat: string;
    contentDocument: {
      schemaVersion: number;
      blocks: Array<{
        id: string;
        type: string;
        text: string;
        marks: never[];
      }>;
    };
    documentSchemaVersion: number;
    access: {
      type: string;
      state: string;
      priceCredits: string;
      entitlementId: string;
    };
    media: Array<{
      mediaAssetId: string;
      sortOrder: number;
      altText: string;
      caption: null;
      width: number;
      height: number;
      slices: Array<{
        id: string;
        sliceIndex: number;
        width: number;
        height: number;
        offsetY: number;
        aspectRatio: number;
        urls: { avif: string; webp: string; jpeg: string };
      }>;
    }>;
    wordCount: number;
    publishedAt: string;
    snapshotAt: string;
  }>;
} {
  return {
    packageId: 'package-1',
    name: 'Gói cuối tuần',
    description: null,
    status: 'READY',
    licenseExpiresAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-09-08T00:00:00.000Z',
    totalSizeBytes: '1200',
    chapterCount: 1,
    chapters: [
      {
        chapterId: 'chapter-1',
        story: { id: 'story-1', slug: 'truyen-a', title: 'Truyện A' },
        number: 1,
        title: 'Chương 1',
        slug: 'chuong-1',
        chapterVersion: 3,
        content: 'Nội dung',
        contentFormat: 'rich_text',
        contentDocument: {
          schemaVersion: 1,
          blocks: [{ id: 'block-1', type: 'paragraph', text: 'Nội dung', marks: [] }],
        },
        documentSchemaVersion: 1,
        access: {
          type: 'PAID',
          state: 'ENTITLED',
          priceCredits: '5.00',
          entitlementId: 'entitlement-1',
        },
        media: [
          {
            mediaAssetId: 'media-1',
            sortOrder: 0,
            altText: 'Trang 1',
            caption: null,
            width: 800,
            height: 1200,
            slices: [
              {
                id: 'slice-1',
                sliceIndex: 0,
                width: 800,
                height: 1200,
                offsetY: 0,
                aspectRatio: 2 / 3,
                urls: {
                  avif: 'https://cdn.example.com/slice-1.avif',
                  webp: 'https://cdn.example.com/slice-1.webp',
                  jpeg: 'https://cdn.example.com/slice-1.jpg',
                },
              },
            ],
          },
        ],
        wordCount: 2,
        publishedAt: '2026-09-01T00:00:00.000Z',
        snapshotAt: '2026-09-08T00:00:00.000Z',
      },
    ],
  };
}
