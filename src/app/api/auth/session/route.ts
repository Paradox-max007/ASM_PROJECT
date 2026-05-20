import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    // If userId is provided, return user session data including theme and menu permissions
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          theme: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      // Fetch menu permissions for admin users
      let menuPermissions: Record<string, boolean> = {};
      if (user.role === 'admin') {
        const perms = await db.adminMenuPermission.findMany({
          where: { userId: user.id },
          select: { menuKey: true, allowed: true },
        });
        for (const p of perms) {
          menuPermissions[p.menuKey] = p.allowed;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          user,
          menuPermissions,
        },
      });
    }

    // Default: check if any users exist (for signup flow)
    const superAdmin = await db.user.findFirst({
      where: { role: 'super_admin' },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        hasUsers: !!superAdmin,
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
