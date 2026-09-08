import type { OfflineReadingPersistencePort } from '../../ports';
import { CreateOfflinePackageCommand } from './create-offline-package.command';
import { CreateOfflinePackageCommandHandler } from './create-offline-package.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('CreateOfflinePackageCommandHandler', () => {
  it('normalizes input before delegating to the atomic persistence port', async () => {
    const created = { id: 'package-1' };
    const persistence = {
      createPackage: jest.fn().mockResolvedValue(created),
    } as unknown as OfflineReadingPersistencePort;
    const handler = new CreateOfflinePackageCommandHandler(persistence);

    await expect(
      handler.execute(
        new CreateOfflinePackageCommand(
          USER_ID,
          SESSION_ID,
          '  Bộ   truyện  ',
          '  mô tả  ',
          [CHAPTER_ID],
        ),
      ),
    ).resolves.toBe(created);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(persistence.createPackage).toHaveBeenCalledWith({
      userId: USER_ID,
      sessionId: SESSION_ID,
      name: 'Bộ truyện',
      description: 'mô tả',
      chapterIds: [CHAPTER_ID],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      now: expect.any(Date),
    });
  });

  it('rejects duplicate chapters before calling persistence', () => {
    const persistence = {
      createPackage: jest.fn(),
    } as unknown as OfflineReadingPersistencePort;
    const handler = new CreateOfflinePackageCommandHandler(persistence);

    expect(() =>
      handler.execute(
        new CreateOfflinePackageCommand(
          USER_ID,
          SESSION_ID,
          'Bộ truyện',
          undefined,
          [CHAPTER_ID, CHAPTER_ID],
        ),
      ),
    ).toThrow('Danh sách chương không được trùng lặp');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(persistence.createPackage).not.toHaveBeenCalled();
  });
});
