/*
 * Một penName chỉ được thuộc tối đa một author application
 * đang ở trạng thái PENDING, không phân biệt hoa thường.
 *
 * Không thể biểu diễn constraint này bằng Prisma schema vì:
 *
 * - functional index: LOWER(pen_name)
 * - partial index: WHERE status = 'pending'
 *
 * Vì vậy migration SQL là source of truth cho invariant này.
 */


/*
 * Fail migration rõ ràng nếu database hiện tại đã có
 * dữ liệu vi phạm invariant.
 *
 * Không tự động chọn application thắng vì đó là business decision.
 */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "author_applications"
    WHERE
      "status" = 'pending'
      AND "pen_name" IS NOT NULL
    GROUP BY LOWER("pen_name")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce pending author pen-name uniqueness: duplicate pending pen names already exist';
  END IF;
END
$$;


/*
 * PostgreSQL là authority cuối cùng.
 *
 * Ví dụ:
 *
 * Moon
 * moon
 * MOON
 *
 * đều cùng một key khi status = pending.
 *
 * DRAFT/REJECTED không bị constraint này khóa,
 * vì user vẫn phải được phép chỉnh sửa/resubmit.
 */
CREATE UNIQUE INDEX
  "author_applications_pending_pen_name_lower_unique"
ON "author_applications" (
  LOWER("pen_name")
)
WHERE
  "status" = 'pending'
  AND "pen_name" IS NOT NULL;
