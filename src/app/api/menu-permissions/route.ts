import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_MENU_KEYS = [
  'employees',
  'sites',
  'attendance',
  'leave_requests',
  'cancellation_requests',
  'notifications',
];

// GET /api/menu-permissions?userId=xxx - Fetch menu permissions for a specific admin user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const permissions = await db.adminMenuPermission.findMany({
      where: { userId },
      orderBy: { menuKey: 'asc' },
    });

    // Build a map of menuKey -> allowed
    const permissionsMap: Record<string, boolean> = {};
    for (const p of permissions) {
      permissionsMap[p.menuKey] = p.allowed;
    }

    return NextResponse.json({
      success: true,
      data: {
        permissions: permissionsMap,
        userId,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/menu-permissions - Set/update menu permission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, menuKey, allowed } = body;

    if (!userId || !menuKey || allowed === undefined) {
      return NextResponse.json(
        { success: false, error: 'userId, menuKey, and allowed are required' },
        { status: 400 }
      );
    }

    if (!VALID_MENU_KEYS.includes(menuKey)) {
      return NextResponse.json(
        { success: false, error: `Invalid menuKey. Must be one of: ${VALID_MENU_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof allowed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'allowed must be a boolean' },
        { status: 400 }
      );
    }

    // Verify user exists and is an admin
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role === 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Cannot set menu permissions for super admin. Super admins have access to all menus.' },
        { status: 400 }
      );
    }

    // Upsert the permission
    const permission = await db.adminMenuPermission.upsert({
      where: {
        userId_menuKey: { userId, menuKey },
      },
      create: {
        userId,
        menuKey,
        allowed,
      },
      update: {
        allowed,
      },
    });

    return NextResponse.json({
      success: true,
      data: { permission },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/menu-permissions - Remove all permissions for a user
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const result = await db.adminMenuPermission.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
