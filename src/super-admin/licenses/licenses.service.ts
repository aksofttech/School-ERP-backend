import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LicensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, plan?: string) {
    let query = `SELECT * FROM "licenses" WHERE 1=1`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER("name") LIKE $${params.length} OR LOWER("key") LIKE $${params.length} OR LOWER("plan") LIKE $${params.length})`;
    }

    if (plan && plan !== 'All Assets') {
      params.push(`%${plan.toLowerCase()}%`);
      query += ` AND LOWER("plan") LIKE $${params.length}`;
    }

    query += ` ORDER BY "createdAt" DESC`;

    const licenses = await this.prisma.$queryRawUnsafe(query, ...params);
    return licenses;
  }

  async findOne(id: string) {
    const list: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "licenses" WHERE "id" = $1 LIMIT 1`,
      id,
    );
    if (!list || list.length === 0) {
      throw new NotFoundException(`License with ID ${id} not found`);
    }
    return list[0];
  }

  async create(data: {
    name: string;
    key?: string;
    plan: string;
    seats?: number;
    totalSeats?: number;
    status?: string;
    expiry?: string;
    autoRenew?: boolean;
    icon?: string;
    color?: string;
    cost?: string;
    vendor?: string;
  }) {
    const id = `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const generatedKey =
      data.key ||
      `LIC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-2027`;
    const initials = (data.name || 'LC').slice(0, 2).toUpperCase();
    const cost = data.cost
      ? data.cost.startsWith('₹')
        ? data.cost
        : `₹${data.cost}`
      : '₹3,000';

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "licenses" (
        "id", "name", "key", "plan", "seats", "totalSeats", "status", "expiry", "autoRenew", "icon", "color", "cost", "vendor"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      id,
      data.name,
      generatedKey,
      data.plan || 'Enterprise',
      Number(data.seats) || 0,
      Number(data.totalSeats) || 100,
      data.status || 'Active',
      data.expiry || 'Dec 31, 2027',
      data.autoRenew !== undefined ? Boolean(data.autoRenew) : true,
      data.icon || initials,
      data.color || 'indigo',
      cost,
      data.vendor || 'Third-Party Vendor',
    );

    return this.findOne(id);
  }

  async update(
    id: string,
    data: {
      name?: string;
      plan?: string;
      seats?: number;
      totalSeats?: number;
      status?: string;
      expiry?: string;
      autoRenew?: boolean;
      cost?: string;
      vendor?: string;
    },
  ) {
    const existing = await this.findOne(id);

    const updatedName = data.name !== undefined ? data.name : existing.name;
    const updatedPlan = data.plan !== undefined ? data.plan : existing.plan;
    const updatedSeats =
      data.seats !== undefined ? Number(data.seats) : existing.seats;
    const updatedTotalSeats =
      data.totalSeats !== undefined
        ? Number(data.totalSeats)
        : existing.totalSeats;
    const updatedStatus =
      data.status !== undefined ? data.status : existing.status;
    const updatedExpiry =
      data.expiry !== undefined ? data.expiry : existing.expiry;
    const updatedAutoRenew =
      data.autoRenew !== undefined
        ? Boolean(data.autoRenew)
        : existing.autoRenew;
    const updatedCost = data.cost !== undefined ? data.cost : existing.cost;
    const updatedVendor =
      data.vendor !== undefined ? data.vendor : existing.vendor;

    await this.prisma.$executeRawUnsafe(
      `UPDATE "licenses" SET
        "name" = $1,
        "plan" = $2,
        "seats" = $3,
        "totalSeats" = $4,
        "status" = $5,
        "expiry" = $6,
        "autoRenew" = $7,
        "cost" = $8,
        "vendor" = $9,
        "updatedAt" = NOW()
      WHERE "id" = $10`,
      updatedName,
      updatedPlan,
      updatedSeats,
      updatedTotalSeats,
      updatedStatus,
      updatedExpiry,
      updatedAutoRenew,
      updatedCost,
      updatedVendor,
      id,
    );

    return this.findOne(id);
  }

  async renew(id: string) {
    await this.findOne(id);

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const formattedExpiry = nextYear.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "licenses" SET
        "status" = 'Active',
        "expiry" = $1,
        "autoRenew" = true,
        "updatedAt" = NOW()
      WHERE "id" = $2`,
      formattedExpiry,
      id,
    );

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "licenses" WHERE "id" = $1`,
      id,
    );
    return { success: true, message: `License ${id} deleted successfully` };
  }

  async getStats() {
    const list: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "licenses"`,
    );

    const total = list.length;
    const active = list.filter((l) => l.status === 'Active').length;
    const expiring = list.filter((l) => l.status === 'Expiring Soon').length;
    const avgUtilization =
      total > 0
        ? Math.round(
            (list.reduce(
              (acc, curr) => acc + curr.seats / (curr.totalSeats || 1),
              0,
            ) /
              total) *
              100,
          )
        : 0;

    return {
      total,
      active,
      expiring,
      avgUtilization,
    };
  }
}
