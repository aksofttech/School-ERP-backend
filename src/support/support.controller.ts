import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @Roles(Role.STUDENT, Role.PARENT)
  createTicket(
    @Body() createTicketDto: CreateTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.supportService.createTicket(createTicketDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('tickets')
  findAllTickets(
    @Query() listTicketsDto: ListTicketsDto,
    @CurrentUser() user: any,
  ) {
    return this.supportService.findAllTickets(listTicketsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('tickets/:id')
  findOneTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supportService.findOneTicket(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post('tickets/:id/messages')
  addMessage(
    @Param('id') ticketId: string,
    @Body() addMessageDto: Omit<AddMessageDto, 'ticketId'>,
    @CurrentUser() user: any,
  ) {
    return this.supportService.addMessage(
      { ...addMessageDto, ticketId },
      {
        userId: user.userId,
        role: user.role,
        schoolId: user.schoolId,
      },
    );
  }

  @Patch('tickets/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  updateTicket(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.supportService.updateTicket(id, updateTicketDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
