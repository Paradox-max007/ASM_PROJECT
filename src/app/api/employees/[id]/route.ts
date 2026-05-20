import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';

function decryptEmployee(employee: Record<string, unknown>) {
  if (employee.passportNumber) {
    employee.passportNumber = decrypt(employee.passportNumber as string);
  }
  if (employee.idNumber) {
    employee.idNumber = decrypt(employee.idNumber as string);
  }
  return employee;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        attendance: {
          where: { isHidden: false },
          orderBy: { date: 'desc' },
        },
        warnings: {
          where: { isHidden: false },
          orderBy: { createdAt: 'desc' },
        },
        fines: {
          where: { isHidden: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const decrypted = decryptEmployee({
      ...employee,
      dateOfBirth: employee.dateOfBirth?.toISOString() || null,
      joinDate: employee.joinDate?.toISOString() || null,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
      attendance: employee.attendance.map((a: { createdAt: Date; updatedAt: Date }) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      warnings: employee.warnings.map((w: { createdAt: Date; updatedAt: Date }) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
      fines: employee.fines.map((f: { createdAt: Date; updatedAt: Date }) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    });

    return NextResponse.json({
      success: true,
      data: { employee: decrypted },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    const updatableFields = [
      'fullName', 'nationality', 'phone', 'email', 'address',
      'emergencyContact', 'position', 'companyName', 'passportStatus',
      'idStatus', 'currentSite', 'photo', 'status',
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (body.dateOfBirth) {
      data.dateOfBirth = new Date(body.dateOfBirth);
    }
    if (body.joinDate) {
      data.joinDate = new Date(body.joinDate);
    }
    if (body.rating !== undefined) {
      data.rating = body.rating;
    }

    // Prevent dual site assignment: if setting currentSite, verify the site is active and employee isn't already in another site
    if (body.currentSite !== undefined && body.currentSite !== null && body.currentSite !== '') {
      // Check that the employee isn't already assigned to a different site
      if (existing.currentSite && existing.currentSite !== body.currentSite) {
        // Employee is being transferred - this is allowed, just verify the new site exists and is active
        const targetSite = await db.site.findFirst({
          where: { name: body.currentSite, isActive: true },
        });
        if (!targetSite) {
          return NextResponse.json(
            { success: false, error: `Site "${body.currentSite}" does not exist or is inactive. Cannot assign employee to an inactive site.` },
            { status: 400 }
          );
        }
      } else if (!existing.currentSite) {
        // Employee has no site, verify the new site exists and is active
        const targetSite = await db.site.findFirst({
          where: { name: body.currentSite, isActive: true },
        });
        if (!targetSite) {
          return NextResponse.json(
            { success: false, error: `Site "${body.currentSite}" does not exist or is inactive. Cannot assign employee to an inactive site.` },
            { status: 400 }
          );
        }
      }
    }

    // Handle team leader fields
    if (body.isTeamLeader !== undefined) {
      if (body.isTeamLeader === true) {
        const teamLeaderSiteId = body.teamLeaderSiteId || null;
        if (teamLeaderSiteId) {
          // Check if another employee is already team leader of this site
          const existingLeader = await db.employee.findFirst({
            where: {
              isTeamLeader: true,
              teamLeaderSiteId,
              id: { not: id },
              status: { not: 'deleted' },
            },
          });
          if (existingLeader) {
            return NextResponse.json(
              { success: false, error: `Another employee (${existingLeader.fullName}) is already team leader of this site. Remove them first.` },
              { status: 409 }
            );
          }
        }
        data.isTeamLeader = true;
        data.teamLeaderSiteId = teamLeaderSiteId;
      } else {
        // Setting isTeamLeader to false — clear teamLeaderSiteId as well
        data.isTeamLeader = false;
        data.teamLeaderSiteId = null;
      }
    } else if (body.teamLeaderSiteId !== undefined) {
      // Only updating the site assignment without changing isTeamLeader flag
      data.teamLeaderSiteId = body.teamLeaderSiteId || null;
    }

    // Encrypt sensitive fields
    if (body.passportNumber !== undefined) {
      data.passportNumber = body.passportNumber ? encrypt(body.passportNumber) : null;
    }
    if (body.idNumber !== undefined) {
      data.idNumber = body.idNumber ? encrypt(body.idNumber) : null;
    }

    const employee = await db.employee.update({
      where: { id },
      data: data as Parameters<typeof db.employee.update>[0]['data'],
    });

    const decrypted = decryptEmployee({
      ...employee,
      dateOfBirth: employee.dateOfBirth?.toISOString() || null,
      joinDate: employee.joinDate?.toISOString() || null,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { employee: decrypted },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    if (existing.status === 'pending_deletion') {
      return NextResponse.json(
        { success: false, error: 'Employee is pending deletion. Please use the delete request approval workflow.' },
        { status: 400 }
      );
    }

    const employee = await db.employee.update({
      where: { id },
      data: { 
        status: 'deleted',
        currentSite: null,
        isTeamLeader: false,
        teamLeaderSiteId: null,
      },
    });

    // Soft-hide all related records instead of deleting them
    // Mark all attendance records for this employee as hidden
    await db.attendance.updateMany({
      where: { employeeId: id },
      data: { isHidden: true },
    });

    // Mark all warnings for this employee as hidden
    await db.warning.updateMany({
      where: { employeeId: id },
      data: { isHidden: true },
    });

    // Mark all fines for this employee as hidden
    await db.fine.updateMany({
      where: { employeeId: id },
      data: { isHidden: true },
    });

    // Mark all leave requests for this employee as hidden
    await db.leaveRequest.updateMany({
      where: { employeeId: id },
      data: { isHidden: true },
    });

    // Mark all cancellation requests for this employee as hidden
    await db.cancellationRequest.updateMany({
      where: { employeeId: id },
      data: { isHidden: true },
    });

    // Mark all uniform registry records for this employee as hidden and deleted
    await db.uniformRegistry.updateMany({
      where: { employeeId: id, isDeleted: false },
      data: { isDeleted: true, isHidden: true },
    });

    // Mark notifications that reference this employee as hidden
    // Search by employee name and employee ID in title/message
    await db.notification.updateMany({
      where: {
        OR: [
          { title: { contains: existing.fullName, mode: 'insensitive' } },
          { message: { contains: existing.fullName, mode: 'insensitive' } },
          { title: { contains: existing.employeeId, mode: 'insensitive' } },
          { message: { contains: existing.employeeId, mode: 'insensitive' } },
        ],
      },
      data: { isHidden: true },
    });

    return NextResponse.json({
      success: true,
      data: { employee: { id: employee.id, status: employee.status } },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
