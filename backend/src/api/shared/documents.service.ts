import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '@prisma/client';

interface PaginationParams {
  page?: number;
  limit?: number;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Upload a document for a student
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    metadata: {
      type: string;
      fileName?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Find the student and user associated with this user
      const student = await this.prisma.student.findFirst({
        where: { userId },
        include: {
          user: {
            select: { name: true, role: true, institutionId: true },
          },
        },
      });

      if (!student) {
        throw new ForbiddenException('Only students can upload documents');
      }

      // Upload to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadDocument(
        file,
        `documents/${student.id}`,
      );

      // Save document record to database
      const document = await this.prisma.document.create({
        data: {
          studentId: student.id,
          type: metadata.type as any,
          fileName: metadata.fileName || file.originalname,
          fileUrl: uploadResult.secure_url,
        },
      });

      // Log document upload
      this.auditService.log({
        action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
        entityType: 'Document',
        entityId: document.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role,
        description: `Document uploaded: ${document.fileName} (${metadata.type})`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: {
          documentId: document.id,
          fileName: document.fileName,
          type: document.type,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      }).catch(() => {}); // Non-blocking

      this.logger.log(`Document uploaded: ${document.id} for student: ${student.id}`);

      return {
        id: document.id,
        url: document.fileUrl,
        filename: document.fileName,
        mimeType: file.mimetype,
        size: file.size,
        type: document.type,
        uploadedAt: document.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to upload document', error.stack);
      throw error;
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string, userId: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          Student: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Verify user has access to this document
      if (document.Student.userId !== userId) {
        throw new ForbiddenException('You do not have access to this document');
      }

      return {
        id: document.id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        type: document.type,
        uploadedAt: document.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get document ${documentId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          Student: {
            select: {
              id: true,
              userId: true,
              user: {
                select: { name: true, role: true, institutionId: true },
              },
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Verify user has access to this document
      if (document.Student.userId !== userId) {
        throw new ForbiddenException('You do not have access to this document');
      }

      // Store document info for audit before deletion
      const deletedDocInfo = {
        documentId: document.id,
        fileName: document.fileName,
        type: document.type,
        studentId: document.Student.id,
      };

      // Extract public ID from Cloudinary URL
      const publicId = this.extractPublicIdFromUrl(document.fileUrl);

      // Delete from Cloudinary
      if (publicId) {
        await this.cloudinaryService.deleteResource(publicId, 'raw');
      }

      // Delete from database
      await this.prisma.document.delete({
        where: { id: documentId },
      });

      // Log document deletion
      this.auditService.log({
        action: AuditAction.STUDENT_DOCUMENT_DELETE,
        entityType: 'Document',
        entityId: documentId,
        userId,
        userName: document.Student.user.name,
        userRole: document.Student.user.role,
        description: `Document deleted: ${document.fileName} (${document.type})`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.HIGH,
        institutionId: document.Student.user.institutionId || undefined,
        ipAddress,
        userAgent,
        oldValues: deletedDocInfo,
      }).catch(() => {}); // Non-blocking

      this.logger.log(`Document deleted: ${documentId}`);

      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all documents for a user with pagination
   */
  async getUserDocuments(userId: string, pagination?: PaginationParams) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      // Find the student associated with this user
      const student = await this.prisma.student.findFirst({
        where: { userId },
      });

      if (!student) {
        throw new ForbiddenException('Only students can view documents');
      }

      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where: { studentId: student.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            type: true,
            createdAt: true,
          },
        }),
        this.prisma.document.count({
          where: { studentId: student.id },
        }),
      ]);

      return {
        data: documents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user documents', error.stack);
      throw error;
    }
  }

  /**
   * Extract Cloudinary public ID from URL
   */
  private extractPublicIdFromUrl(url: string): string | null {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');

      if (uploadIndex === -1) {
        return null;
      }

      const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
      const publicId = pathAfterUpload.split('.')[0];

      return publicId;
    } catch (error) {
      this.logger.warn('Failed to extract public ID from URL', error);
      return null;
    }
  }
}
