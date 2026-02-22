export function prismaErrorCode(err) {
  return typeof err?.code === 'string' ? err.code : null;
}

export function isPrismaError(err, codes) {
  const code = prismaErrorCode(err);
  if (!code) return false;

  if (Array.isArray(codes)) return codes.includes(code);
  return code === codes;
}

export function isPrismaMissingTableError(err) {
  return isPrismaError(err, ['P2021', 'P2010']);
}

export function isPrismaUniqueConstraintError(err) {
  return isPrismaError(err, 'P2002');
}

export function isPrismaValueTooLongError(err) {
  return isPrismaError(err, 'P2000');
}

export function isPrismaConnectionError(err) {
  return isPrismaError(err, ['P1001', 'P1002']);
}
