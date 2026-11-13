/**
 * Errors the service layer throws on purpose. Their messages are written for
 * the end user (Arabic) and are safe to show; anything else is a bug and is
 * reported with a generic message.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Not logged in. */
export class UnauthenticatedError extends AppError {
  constructor(message = "انتهت الجلسة، سجّل الدخول من جديد") {
    super(message);
  }
}

/** Logged in but not allowed. */
export class ForbiddenError extends AppError {
  constructor(message = "غير مصرح لك بهذا الإجراء") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "العنصر غير موجود") {
    super(message);
  }
}

/** Breaks a business rule: duplicates, closed month, wrong state… */
export class ConflictError extends AppError {}

/** Input failed validation. */
export class ValidationError extends AppError {
  constructor(
    message = "البيانات المدخلة غير صحيحة",
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
