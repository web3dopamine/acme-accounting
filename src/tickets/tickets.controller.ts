import { Body, ConflictException, Controller, Get, Post, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { Op } from 'sequelize';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  type?: TicketType;
  companyId?: number;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      companyId,
    } = query;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive numbers');
    }

    const offset = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (companyId) where.companyId = companyId;

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [Company, User],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    // Validate input
    if (!type || !companyId) {
      throw new BadRequestException('Type and companyId are required');
    }

    if (!Object.values(TicketType).includes(type)) {
      throw new BadRequestException('Invalid ticket type');
    }

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check for duplicate registrationAddressChange tickets
    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: { companyId, type: TicketType.registrationAddressChange },
      });
      if (existingTicket) {
        throw new ConflictException(
          'A registrationAddressChange ticket already exists for this company',
        );
      }
    }

    let category: TicketCategory;
    let userRole: UserRole;

    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
      userRole = UserRole.accountant;
    } else if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
      const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
      });

      if (directors.length === 1) {
        userRole = UserRole.director;
      } else if (directors.length > 1) {
        throw new ConflictException(
          'Multiple directors found. Cannot create a strikeOff ticket',
        );
      } else {
        throw new ConflictException(
          'No director found. Cannot create a strikeOff ticket',
        );
      }

      // Resolve all other active tickets for this company
      await Ticket.update(
        { status: TicketStatus.resolved },
        {
          where: {
            companyId,
            status: TicketStatus.open,
            type: { [Op.ne]: TicketType.strikeOff },
          },
        },
      );
    } else {
      category = TicketCategory.corporate;
      // Try corporate secretary first, then fall back to director
      const secretaries = await User.findAll({
        where: { companyId, role: UserRole.corporateSecretary },
      });
      
      if (secretaries.length === 1) {
        userRole = UserRole.corporateSecretary;
      } else if (secretaries.length > 1) {
        throw new ConflictException(
          'Multiple corporate secretaries found. Cannot create a ticket',
        );
      } else {
        // No secretary found, try director
        const directors = await User.findAll({
          where: { companyId, role: UserRole.director },
        });
        
        if (directors.length === 1) {
          userRole = UserRole.director;
        } else if (directors.length > 1) {
          throw new ConflictException(
            'Multiple directors found. Cannot create a ticket',
          );
        } else {
          throw new ConflictException(
            'No suitable assignee found for this ticket type',
          );
        }
      }
    }

    const assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });

    if (!assignees.length)
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );

    const assignee = assignees[0];

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
