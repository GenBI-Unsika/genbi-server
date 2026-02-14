export function prismaErrorCode(err) {
  return typeof err?.code === 'string' ? err.code : null;
}

export function isPrismaError(err, codes) {
  const code = prismaErrorCode(err);
  if (!code) return false;

  if (Array.isArray(codes)) return codes.includes(code);
  return code === codes;
}

// Common: schema/table not in sync with DB (often happens before migrations run)
export function isPrismaMissingTableError(err) {
  return isPrismaError(err, ['P2021', 'P2010']);
}

// Common: unique constraint violation
export function isPrismaUniqueConstraintError(err) {
  return isPrismaError(err, 'P2002');
}

// Common: value too long for column type
export function isPrismaValueTooLongError(err) {
  return isPrismaError(err, 'P2000');
}

// Common: DB not reachable / connection issues
export function isPrismaConnectionError(err) {
  // Prisma commonly uses these codes for connection issues:
  // - P1001: Can't reach database server
  // - P1002: The database server was reached but timed out
  return isPrismaError(err, ['P1001', 'P1002']);
}
