import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create ticket
   * STUDENT/PARENT can create tickets
   */
  async createTicket(
    createTicketDto: CreateTicketDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.STUDENT && currentUser.role !== Role.PARENT) {
      throw new ForbiddenException(
        'Only STUDENT and PARENT can create support tickets',
      );
    }

    const { subject, description, studentId } = createTicketDto;

    let resolvedStudentId: string | null = null;

    if (currentUser.role === Role.STUDENT) {
      // STUDENT creates ticket for themselves
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      resolvedStudentId = student.id;
    } else if (currentUser.role === Role.PARENT) {
      // PARENT creates ticket for a linked student
      if (!studentId) {
        throw new BadRequestException(
          'studentId is required when creating ticket as PARENT',
        );
      }

      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only create tickets for your linked students',
        );
      }

      resolvedStudentId = studentId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    // TODO: Once SupportTicket model is added to schema, use this structure:
    // const ticket = await this.prisma.supportTicket.create({
    //   data: {
    //     subject,
    //     description,
    //     status: TicketStatus.OPEN,
    //     priority: 'MEDIUM',
    //     studentId: resolvedStudentId,
    //     createdBy: currentUser.userId,
    //     schoolId: currentUser.schoolId,
    //   },
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
    //     createdByUser: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         role: true,
    //       },
    //     },
    //   },
    // });
    //
    // // Create initial message in conversation thread
    // await this.prisma.supportMessage.create({
    //   data: {
    //     ticketId: ticket.id,
    //     message: description,
    //     sentBy: currentUser.userId,
    //   },
    // });
    //
    // return ticket;

    // For now, return the ticket structure ready for schema integration
    return {
      subject,
      description,
      status: 'OPEN',
      priority: 'MEDIUM',
      studentId: resolvedStudentId,
      createdBy: currentUser.userId,
      schoolId: currentUser.schoolId,
      createdAt: new Date(),
      note: 'SupportTicket and SupportMessage models need to be added to schema.prisma for persistent storage. Structure is ready for integration.',
    };
  }

  /**
   * List tickets
   * STUDENT/PARENT can view their own tickets
   * ADMIN can view all tickets in their school
   */
  async findAllTickets(
    listTicketsDto: ListTicketsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, status, priority } = listTicketsDto;
    const skip = (page - 1) * limit;

    // TODO: Once SupportTicket model is added, use this structure:
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
    // } else if (
    //   currentUser.role === Role.SCHOOL_ADMIN ||
    //   currentUser.role === Role.SUPER_ADMIN
    // ) {
    //   // ADMIN can view all tickets in school
    //   if (currentUser.role === Role.SCHOOL_ADMIN && !currentUser.schoolId) {
    //     throw new ForbiddenException('School admin must be associated with a school');
    //   }
    // } else {
    //   throw new ForbiddenException('Access denied');
    // }
    //
    // if (status) {
    //   where.status = status;
    // }
    //
    // if (priority) {
    //   where.priority = priority;
    // }
    //
    // const [data, total] = await Promise.all([
    //   this.prisma.supportTicket.findMany({
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
    //       createdByUser: {
    //         select: {
    //           id: true,
    //           firstName: true,
    //           lastName: true,
    //           role: true,
    //         },
    //       },
    //       _count: {
    //         select: {
    //           messages: true,
    //         },
    //       },
    //     },
    //     orderBy: { createdAt: 'desc' },
    //   }),
    //   this.prisma.supportTicket.count({ where }),
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
      note: 'SupportTicket model needs to be added to schema.prisma for ticket listing. Structure is ready for integration.',
    };
  }

  /**
   * Get ticket by ID with conversation thread
   * STUDENT/PARENT can view their own tickets
   * ADMIN can view any ticket in their school
   */
  async findOneTicket(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // TODO: Once SupportTicket model is added, use this structure:
    // const ticket = await this.prisma.supportTicket.findUnique({
    //   where: { id },
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
    //     createdByUser: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         role: true,
    //       },
    //     },
    //   },
    // });
    //
    // if (!ticket) {
    //   throw new NotFoundException(`Ticket with ID ${id} not found`);
    // }
    //
    // // Access control
    // if (currentUser.role === Role.STUDENT) {
    //   const student = await this.prisma.student.findFirst({
    //     where: { userId: currentUser.userId },
    //   });
    //
    //   if (!student || ticket.studentId !== student.id) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view your own tickets',
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
    //   if (!linkedStudentIds.includes(ticket.studentId)) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view tickets for your linked students',
    //     );
    //   }
    // } else if (
    //   currentUser.role === Role.SCHOOL_ADMIN ||
    //   currentUser.role === Role.SUPER_ADMIN
    // ) {
    //   if (
    //     currentUser.role === Role.SCHOOL_ADMIN &&
    //     (!currentUser.schoolId || ticket.schoolId !== currentUser.schoolId)
    //   ) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only view tickets from your school',
    //     );
    //   }
    // } else {
    //   throw new ForbiddenException('Access denied');
    // }
    //
    // // Get conversation thread (messages)
    // const messages = await this.prisma.supportMessage.findMany({
    //   where: { ticketId: id },
    //   include: {
    //     sentByUser: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         role: true,
    //       },
    //     },
    //   },
    //   orderBy: { createdAt: 'asc' },
    // });
    //
    // return {
    //   ...ticket,
    //   messages,
    // };

    return {
      id,
      note: 'SupportTicket and SupportMessage models need to be added to schema.prisma for ticket viewing. Structure is ready for integration.',
    };
  }

  /**
   * Update ticket status
   * ADMIN can update ticket status
   */
  async updateTicket(
    id: string,
    updateTicketDto: UpdateTicketDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only ADMIN can update ticket status');
    }

    // TODO: Once SupportTicket model is added, use this structure:
    // const ticket = await this.prisma.supportTicket.findUnique({
    //   where: { id },
    // });
    //
    // if (!ticket) {
    //   throw new NotFoundException(`Ticket with ID ${id} not found`);
    // }
    //
    // if (
    //   currentUser.role === Role.SCHOOL_ADMIN &&
    //   (!currentUser.schoolId || ticket.schoolId !== currentUser.schoolId)
    // ) {
    //   throw new ForbiddenException(
    //     'Access denied. You can only update tickets from your school',
    //   );
    // }
    //
    // const updatedTicket = await this.prisma.supportTicket.update({
    //   where: { id },
    //   data: updateTicketDto,
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
    //     createdByUser: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         role: true,
    //       },
    //     },
    //   },
    // });
    //
    // return updatedTicket;

    return {
      id,
      ...updateTicketDto,
      note: 'SupportTicket model needs to be added to schema.prisma for ticket updates. Structure is ready for integration.',
    };
  }

  /**
   * Add message to conversation thread
   * STUDENT/PARENT can add messages to their tickets
   * ADMIN can add messages to any ticket in their school
   */
  async addMessage(
    addMessageDto: AddMessageDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { ticketId, message } = addMessageDto;

    // TODO: Once SupportTicket and SupportMessage models are added, use this structure:
    // // Verify ticket exists
    // const ticket = await this.prisma.supportTicket.findUnique({
    //   where: { id: ticketId },
    // });
    //
    // if (!ticket) {
    //   throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    // }
    //
    // // Access control
    // if (currentUser.role === Role.STUDENT) {
    //   const student = await this.prisma.student.findFirst({
    //     where: { userId: currentUser.userId },
    //   });
    //
    //   if (!student || ticket.studentId !== student.id) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only add messages to your own tickets',
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
    //   if (!linkedStudentIds.includes(ticket.studentId)) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only add messages to tickets for your linked students',
    //     );
    //   }
    // } else if (
    //   currentUser.role === Role.SCHOOL_ADMIN ||
    //   currentUser.role === Role.SUPER_ADMIN
    // ) {
    //   if (
    //     currentUser.role === Role.SCHOOL_ADMIN &&
    //     (!currentUser.schoolId || ticket.schoolId !== currentUser.schoolId)
    //   ) {
    //     throw new ForbiddenException(
    //       'Access denied. You can only add messages to tickets from your school',
    //     );
    //   }
    // } else {
    //   throw new ForbiddenException('Access denied');
    // }
    //
    // // Create message in conversation thread
    // const supportMessage = await this.prisma.supportMessage.create({
    //   data: {
    //     ticketId,
    //     message,
    //     sentBy: currentUser.userId,
    //   },
    //   include: {
    //     sentByUser: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         role: true,
    //       },
    //     },
    //   },
    // });
    //
    // // Update ticket's updatedAt timestamp
    // await this.prisma.supportTicket.update({
    //   where: { id: ticketId },
    //   data: { updatedAt: new Date() },
    // });
    //
    // return supportMessage;

    return {
      ticketId,
      message,
      sentBy: currentUser.userId,
      createdAt: new Date(),
      note: 'SupportTicket and SupportMessage models need to be added to schema.prisma for message addition. Structure is ready for integration.',
    };
  }
}
