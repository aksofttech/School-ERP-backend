import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto, DocumentType } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate local file name for document storage
   */
  private generateFilePath(studentId: string, fileName: string): string {
    const timestamp = Date.now();
    const randomString = randomBytes(4).toString('hex');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${studentId}_${timestamp}_${randomString}_${sanitizedFileName}`;
  }

  /**
   * Upload document (S3 ready)
   * SCHOOL_ADMIN/TEACHER can upload documents
   */
  async uploadDocument(
    uploadDocumentDto: UploadDocumentDto,
    file: any,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can upload documents',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    const { studentId, fileName, fileType, documentType, description } =
      uploadDocumentDto;

    // Verify student exists and belongs to school
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    if (student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only upload documents for students in your school',
      );
    }

    // Generate local filename
    const localFileName = this.generateFilePath(studentId, fileName);
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, localFileName);

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    // Save to database
    const document = await this.prisma.document.create({
      data: {
        studentId,
        fileName,
        fileType,
        documentType,
        description: description || null,
        s3Key: localFileName,
        s3Url: `/uploads/documents/${localFileName}`,
        fileSize: file.size,
        uploadedBy: currentUser.userId,
        schoolId: currentUser.schoolId,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        uploadedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return document;
  }

  /**
   * Get presigned URL for document download
   * Access control based on user role
   */
  async getDocumentUrl(
    documentId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // TODO: Once Document model is added, fetch document:
    // const document = await this.prisma.document.findUnique({
    //   where: { id: documentId },
    //   include: {
    //     student: true,
    //   },
    // });
    //
    // if (!document) {
    //   throw new NotFoundException(`Document with ID ${documentId} not found`);
    // }
    //
    // // Access control
    // if (currentUser.role === Role.STUDENT) {
    //   const student = await this.prisma.student.findFirst({
    //     where: { userId: currentUser.userId },
    //   });
    //
    //   if (!student || student.id !== document.studentId) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view your own documents',
    //     );
    //   }
    // } else if (currentUser.role === Role.PARENT) {
    //   const parent = await this.prisma.parent.findFirst({
    //     where: { userId: currentUser.userId },
    //     include: { students: true },
    //   });
    //
    //   if (!parent) {
    //     throw new NotFoundException('Parent profile not found');
    //   }
    //
    //   const linkedStudentIds = parent.students.map((s) => s.id);
    //   if (!linkedStudentIds.includes(document.studentId)) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view documents for your linked students',
    //     );
    //   }
    // } else if (
    //   currentUser.role === Role.SCHOOL_ADMIN ||
    //   currentUser.role === Role.TEACHER
    // ) {
    //   if (document.schoolId !== currentUser.schoolId) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view documents from your school',
    //     );
    //   }
    // }
    //
    // // Generate presigned URL for S3
    // const presignedUrl = await this.s3Service.getSignedUrlPromise('getObject', {
    //   Bucket: process.env.AWS_S3_BUCKET_NAME,
    //   Key: document.s3Key,
    //   Expires: 3600, // 1 hour
    // });
    //
    // return {
    //   documentId: document.id,
    //   fileName: document.fileName,
    //   downloadUrl: presignedUrl,
    //   expiresIn: 3600,
    // };

    // For now, return structure ready for integration
    return {
      documentId,
      note: 'Document model needs to be added to schema.prisma for document URL generation. S3 presigned URL structure is ready for integration.',
    };
  }

  /**
   * List documents
   * Access control based on user role
   */
  async findAll(
    listDocumentsDto: ListDocumentsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, studentId, documentType } = listDocumentsDto;
    const skip = (page - 1) * limit;

    // TODO: Once Document model is added, use this structure:
    // const where: any = {
    //   schoolId: currentUser.schoolId,
    // };
    //
    // if (currentUser.role === Role.STUDENT) {
    //   const student = await this.prisma.student.findFirst({
    //     where: { userId: currentUser.userId },
    //   });
    //
    //   if (!student) {
    //     throw new NotFoundException('Student profile not found');
    //   }
    //
    //   where.studentId = student.id;
    // } else if (currentUser.role === Role.PARENT) {
    //   const parent = await this.prisma.parent.findFirst({
    //     where: { userId: currentUser.userId },
    //     include: { students: true },
    //   });
    //
    //   if (!parent) {
    //     throw new NotFoundException('Parent profile not found');
    //   }
    //
    //   const linkedStudentIds = parent.students.map((s) => s.id);
    //   where.studentId = { in: linkedStudentIds };
    //
    //   if (studentId && !linkedStudentIds.includes(studentId)) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view documents for your linked students',
    //     );
    //   }
    // }
    //
    // if (studentId) {
    //   where.studentId = studentId;
    // }
    //
    // if (documentType) {
    //   where.documentType = documentType;
    // }
    //
    // const [data, total] = await Promise.all([
    //   this.prisma.document.findMany({
    //     where,
    //     skip,
    //     take: limit,
    //     include: {
    //       student: {
    //         include: {
    //           user: {
    //             select: {
    //               id: true,
    //               firstName: true,
    //               lastName: true,
    //             },
    //           },
    //         },
    //       },
    //       uploadedByUser: {
    //         select: {
    //           id: true,
    //           firstName: true,
    //           lastName: true,
    //         },
    //       },
    //     },
    //     orderBy: { createdAt: 'desc' },
    //   }),
    //   this.prisma.document.count({ where }),
    // ]);
    //
    // return {
    //   data,
    //   meta: {
    //     page,
    //     limit,
    //     total,
    //     totalPages: Math.ceil(total / limit),
    //   },
    // };

    // For now, return empty structure
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      note: 'Document model needs to be added to schema.prisma for document listing. Structure is ready for integration.',
    };
  }

  /**
   * Get student documents
   * Access control based on user role
   */
  async getStudentDocuments(
    studentId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Access control
    if (currentUser.role === Role.STUDENT) {
      const currentStudent = await this.prisma.student.findFirst({
        where: { userId: currentUser.userId },
      });

      if (!currentStudent || currentStudent.id !== studentId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own documents',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: { userId: currentUser.userId },
        include: { students: true },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view documents for your linked students',
        );
      }
    } else if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view documents for students in your school',
        );
      }
    }

    // Fetch documents from database
    const documents = await this.prisma.document.findMany({
      where: {
        studentId,
        schoolId: currentUser.schoolId,
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        rollNumber: student.rollNumber,
      },
      documents,
      total: documents.length,
    };
  }

  /**
   * Update document metadata
   * SCHOOL_ADMIN/TEACHER can update
   */
  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can update documents',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    // TODO: Once Document model is added:
    // const document = await this.prisma.document.findUnique({
    //   where: { id },
    // });
    //
    // if (!document) {
    //   throw new NotFoundException(`Document with ID ${id} not found`);
    // }
    //
    // if (document.schoolId !== currentUser.schoolId) {
    //   throw new ForbiddenException(
    //     'Access denied. You can only update documents from your school',
    //   );
    // }
    //
    // const updatedDocument = await this.prisma.document.update({
    //   where: { id },
    //   data: updateDocumentDto,
    //   include: {
    //     student: {
    //       include: {
    //         user: {
    //           select: {
    //             id: true,
    //             firstName: true,
    //             lastName: true,
    //           },
    //         },
    //       },
    //     },
    //   },
    // });
    //
    // return updatedDocument;

    return {
      id,
      note: 'Document model needs to be added to schema.prisma for document updates. Structure is ready for integration.',
    };
  }

  /**
   * Delete document
   * SCHOOL_ADMIN/TEACHER can delete
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can delete documents',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    // TODO: Once Document model is added:
    // const document = await this.prisma.document.findUnique({
    //   where: { id },
    // });
    //
    // if (!document) {
    //   throw new NotFoundException(`Document with ID ${id} not found`);
    // }
    //
    // if (document.schoolId !== currentUser.schoolId) {
    //   throw new ForbiddenException(
    //     'Access denied. You can only delete documents from your school',
    //   );
    // }
    //
    // // Delete from S3
    // await this.s3Service.deleteObject({
    //   Bucket: process.env.AWS_S3_BUCKET_NAME,
    //   Key: document.s3Key,
    // });
    //
    // // Delete from database
    // await this.prisma.document.delete({
    //   where: { id },
    // });
    //
    // return {
    //   message: 'Document deleted successfully',
    // };

    return {
      message:
        'Document model needs to be added to schema.prisma for document deletion. S3 deletion structure is ready for integration.',
    };
  }
}
