import { ChapterInsertPolicy } from './chapter-insert.policy';

describe('Choosing the number for a chapter inserted between two others', () => {
  const between = (after: number, before: number | null) =>
    ChapterInsertPolicy.numberBetween(after, before);

  it('puts a chapter halfway between two whole numbers', () => {
    expect(between(1, 2)).toBe(1.5);
    expect(between(7, 8)).toBe(7.5);
  });

  it('keeps subdividing while the column still has room', () => {
    expect(between(1, 1.5)).toBe(1.25);
    expect(between(1, 1.25)).toBe(1.12);
    expect(between(1, 1.02)).toBe(1.01);
  });

  /*
   * Decimal(10, 2) hết chỗ khi hai chương chỉ cách nhau một bậc. Trả null để
   * nơi gọi báo lỗi, tuyệt đối không làm tròn vào số đã có: khoá duy nhất
   * (storyId, number) sẽ vỡ và tác giả nhận lỗi database thay vì lời giải thích.
   */
  it('refuses when two chapters are already adjacent', () => {
    expect(between(1.5, 1.51)).toBeNull();
    expect(between(1, 1.01)).toBeNull();
    expect(between(2.99, 3)).toBeNull();
  });

  it('appends after the last chapter', () => {
    expect(between(5, null)).toBe(6);
    // Chương cuối là số lẻ thì chương thêm vào vẫn là số nguyên kế tiếp.
    expect(between(5.5, null)).toBe(6);
    expect(between(5.99, null)).toBe(6);
  });

  it('refuses an anchor that is not before the next chapter', () => {
    expect(between(2, 2)).toBeNull();
    expect(between(3, 2)).toBeNull();
  });

  it('refuses numbers the column could never hold', () => {
    expect(between(Number.NaN, 2)).toBeNull();
    expect(between(1, Number.POSITIVE_INFINITY)).toBeNull();
    expect(between(-1, 2)).toBeNull();
  });

  it('never returns a number outside the gap', () => {
    for (const [after, before] of [
      [1, 2],
      [1, 1.5],
      [1.01, 1.99],
      [10, 10.5],
      [0, 1],
    ] as const) {
      const result = between(after, before);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(after);
      expect(result!).toBeLessThan(before);
      // Phải lưu vừa Decimal(10, 2), không sinh chữ số thập phân thứ ba.
      expect(Number.isInteger(Math.round(result! * 100))).toBe(true);
      expect(result).toBe(Math.round(result! * 100) / 100);
    }
  });
  /*
   * Chèn chương mở đầu gọi đúng hàm này với `after` là 0: phía trước chương đầu
   * truyện không có chương nào nên coi như số 0.
   */
  describe('chèn trước chương đầu truyện', () => {
    it('chia đôi khoảng từ 0 tới số của chương đầu', () => {
      expect(ChapterInsertPolicy.numberBetween(0, 1)).toBe(0.5);
      expect(ChapterInsertPolicy.numberBetween(0, 0.5)).toBe(0.25);
      expect(ChapterInsertPolicy.numberBetween(0, 0.02)).toBe(0.01);
    });

    it('hết chỗ khi chương đầu đã là 0.01', () => {
      expect(ChapterInsertPolicy.numberBetween(0, 0.01)).toBeNull();
    });
  });
});
