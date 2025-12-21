import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * Sanitize Pipe for input validation and sanitization
 * - Sanitizes HTML/script tags from string inputs
 * - Validates file types for uploads
 * - Prevents XSS and injection attacks
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  // Allowed MIME types for file uploads
  private readonly allowedFileTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/csv',
  ];

  // Maximum file size (10MB)
  private readonly maxFileSize = 10 * 1024 * 1024;

  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      return value;
    }

    // Handle file upload validation
    if (this.isFileUpload(value)) {
      return this.validateFile(value);
    }

    // Sanitize string values
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    // Sanitize object recursively
    if (typeof value === 'object' && !Array.isArray(value)) {
      return this.sanitizeObject(value);
    }

    // Sanitize array
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, metadata));
    }

    return value;
  }

  /**
   * Check if value is a file upload
   */
  private isFileUpload(value: any): boolean {
    return (
      value &&
      typeof value === 'object' &&
      ('mimetype' in value || 'fieldname' in value || 'originalname' in value)
    );
  }

  /**
   * Validate file upload
   */
  private validateFile(file: any): any {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check file type
    const mimetype = file.mimetype?.toLowerCase();
    if (!mimetype || !this.allowedFileTypes.includes(mimetype)) {
      throw new BadRequestException(
        `File type ${mimetype} is not allowed. Allowed types: ${this.allowedFileTypes.join(', ')}`,
      );
    }

    // Validate file extension matches MIME type
    if (file.originalname) {
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      if (!this.isValidExtension(extension, mimetype)) {
        throw new BadRequestException(
          'File extension does not match the file type',
        );
      }
    }

    return file;
  }

  /**
   * Validate file extension matches MIME type
   */
  private isValidExtension(extension: string, mimetype: string): boolean {
    const validExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        'xlsx',
      ],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['docx'],
      'application/msword': ['doc'],
      'text/csv': ['csv'],
    };

    const allowed = validExtensions[mimetype] || [];
    return allowed.includes(extension);
  }

  /**
   * Sanitize string to prevent XSS
   */
  private sanitizeString(value: string): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    return (
      value
        // Remove script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove iframe tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        // Remove event handlers
        .replace(/on\w+\s*=/gi, '')
        // Remove javascript: protocol
        .replace(/javascript:/gi, '')
        // Remove data URLs with HTML
        .replace(/data:text\/html/gi, '')
        // Remove potentially dangerous HTML tags
        .replace(/<(embed|object|link|meta|style)\b[^>]*>/gi, '')
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          sanitized[key] = value.map((item) =>
            typeof item === 'string' ? this.sanitizeString(item) : item,
          );
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
