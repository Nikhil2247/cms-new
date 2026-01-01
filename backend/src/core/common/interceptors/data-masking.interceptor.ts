import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Sensitive field patterns and their masking rules
 */
const MASKING_RULES: Record<string, (value: string) => string> = {
  // Aadhaar: Show last 4 digits (XXXX-XXXX-1234)
  aadhaarNumber: (value: string) => {
    if (!value || value.length < 4) return '****';
    const last4 = value.replace(/\D/g, '').slice(-4);
    return `XXXX-XXXX-${last4}`;
  },

  // PAN: Show last 4 characters (XXXXXX1234)
  panNumber: (value: string) => {
    if (!value || value.length < 4) return '****';
    return `XXXXXX${value.slice(-4)}`;
  },

  // Phone: Show last 4 digits (******6789)
  phoneNo: (value: string) => {
    if (!value || value.length < 4) return '****';
    const digits = value.replace(/\D/g, '');
    return `******${digits.slice(-4)}`;
  },
  phone: (value: string) => MASKING_RULES.phoneNo(value),
  mobile: (value: string) => MASKING_RULES.phoneNo(value),
  mobileNumber: (value: string) => MASKING_RULES.phoneNo(value),

  // Bank Account: Show last 4 digits
  bankAccountNumber: (value: string) => {
    if (!value || value.length < 4) return '****';
    return `XXXXXXXX${value.slice(-4)}`;
  },
  accountNumber: (value: string) => MASKING_RULES.bankAccountNumber(value),

  // IFSC: Show first 4 characters
  ifscCode: (value: string) => {
    if (!value || value.length < 4) return '****';
    return `${value.slice(0, 4)}XXXXXXX`;
  },

  // Email: Mask middle part (j***@example.com)
  email: (value: string) => {
    if (!value || !value.includes('@')) return '****';
    const [local, domain] = value.split('@');
    if (local.length <= 2) return `**@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  },
};

/**
 * Fields that should always be masked in responses
 */
const ALWAYS_MASK_FIELDS = [
  'aadhaarNumber',
  'panNumber',
  'bankAccountNumber',
  'accountNumber',
  'ifscCode',
];

/**
 * Fields to mask based on user role
 * Lower roles see masked data, higher roles see full data
 */
const ROLE_BASED_MASK_FIELDS: Record<string, string[]> = {
  STUDENT: ['phoneNo', 'email', 'dob'],
  TEACHER: ['phoneNo'],
};

/**
 * Data Masking Interceptor
 * Masks sensitive PII fields in API responses
 *
 * Usage:
 * - Apply globally or on specific controllers
 * - Configurable per-field masking rules
 * - Role-based masking (some roles see full data)
 */
@Injectable()
export class DataMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role;

    // Skip masking for system admins
    if (userRole === 'SYSTEM_ADMIN' || userRole === 'STATE_DIRECTORATE') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (!data) return data;
        return this.maskData(data, userRole);
      }),
    );
  }

  /**
   * Recursively mask sensitive fields in data
   */
  private maskData(data: any, userRole?: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.maskData(item, userRole));
    }

    // Handle objects
    if (typeof data === 'object') {
      // Skip Date, Buffer, etc.
      if (data instanceof Date || Buffer.isBuffer(data)) {
        return data;
      }

      const masked: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
          masked[key] = value;
          continue;
        }

        // Check if field should be masked
        if (this.shouldMaskField(key, userRole)) {
          if (typeof value === 'string' && MASKING_RULES[key]) {
            masked[key] = MASKING_RULES[key](value);
          } else if (typeof value === 'string') {
            // Default masking for unknown sensitive fields
            masked[key] = this.defaultMask(value);
          } else {
            masked[key] = value;
          }
        } else if (typeof value === 'object') {
          // Recurse into nested objects
          masked[key] = this.maskData(value, userRole);
        } else {
          masked[key] = value;
        }
      }

      return masked;
    }

    return data;
  }

  /**
   * Determine if a field should be masked
   */
  private shouldMaskField(fieldName: string, userRole?: string): boolean {
    // Always mask these fields
    if (ALWAYS_MASK_FIELDS.includes(fieldName)) {
      return true;
    }

    // Role-based masking
    if (userRole && ROLE_BASED_MASK_FIELDS[userRole]) {
      return ROLE_BASED_MASK_FIELDS[userRole].includes(fieldName);
    }

    return false;
  }

  /**
   * Default masking for fields without specific rules
   */
  private defaultMask(value: string): string {
    if (!value || value.length <= 4) {
      return '****';
    }
    return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
  }
}

/**
 * Utility function for manual masking
 */
export function maskSensitiveField(fieldName: string, value: string): string {
  if (!value) return value;
  const maskFn = MASKING_RULES[fieldName];
  return maskFn ? maskFn(value) : value;
}
