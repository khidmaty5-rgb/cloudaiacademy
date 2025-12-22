export type CertificateIdOptions = {
  /**
   * Prefix for your organization.
   * Default: `CA` (CloudAI Academy).
   */
  prefix?: string;
  /**
   * Year the certificate is issued. Defaults to the current year.
   */
  year?: number;
  /**
   * Short course code you define (e.g. `PY101`, `AWSFND`, `AI-BASICS`).
   */
  courseCode: string;
  /**
   * Sequential number (e.g. 127 => `000127`).
   */
  sequence: number;
  /**
   * How many digits to pad the sequential number to.
   * Default: 6.
   */
  sequenceWidth?: number;
};

export function normalizeCourseCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCourseCode(courseCode: string): boolean {
  return (
    courseCode.length >= 2 &&
    courseCode.length <= 12 &&
    /^[A-Z0-9-]+$/.test(courseCode)
  );
}

export function formatCertificateId(options: CertificateIdOptions): string {
  const prefix = (options.prefix ?? 'CA').trim().toUpperCase();
  const year = options.year ?? new Date().getFullYear();
  const courseCode = normalizeCourseCode(options.courseCode);
  const sequenceWidth = options.sequenceWidth ?? 6;

  if (!prefix) {
    throw new Error('Certificate ID prefix is required.');
  }
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('Certificate year must be a 4-digit year.');
  }
  if (!isValidCourseCode(courseCode)) {
    throw new Error(
      'Course code must be 2-12 chars and contain only letters, numbers, and hyphens.',
    );
  }
  if (!Number.isInteger(options.sequence) || options.sequence < 0) {
    throw new Error('Certificate sequence must be a non-negative integer.');
  }
  if (!Number.isInteger(sequenceWidth) || sequenceWidth < 1 || sequenceWidth > 12) {
    throw new Error('sequenceWidth must be an integer between 1 and 12.');
  }

  const sequence = String(options.sequence).padStart(sequenceWidth, '0');
  return `${prefix}-${year}-${courseCode}-${sequence}`;
}
