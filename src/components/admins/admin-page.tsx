'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  UserCog,
  Search,
  Mail,
  Lock,
  Crown,
  KeyRound,
  Users,
  Building2,
  Calendar,
  FileText,
  Ban,
  Bell,
  LayoutDashboard,
  Shirt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminFormData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'super_admin';
}

interface MenuPermissionItem {
  key: string;
  label: string;
  icon: React.ElementType;
  alwaysVisible: boolean;
}

const MENU_ITEMS: MenuPermissionItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysVisible: true },
  { key: 'uniform_registry', label: 'Uniform Registry', icon: Shirt, alwaysVisible: true },
  { key: 'employees', label: 'Employees', icon: Users, alwaysVisible: false },
  { key: 'sites', label: 'Sites', icon: Building2, alwaysVisible: false },
  { key: 'attendance', label: 'Attendance', icon: Calendar, alwaysVisible: false },
  { key: 'leave_requests', label: 'Leave Requests', icon: FileText, alwaysVisible: false },
  { key: 'cancellation_requests', label: 'Cancellations', icon: Ban, alwaysVisible: false },
  { key: 'notifications', label: 'Notifications', icon: Bell, alwaysVisible: false },
];

const TOGGLEABLE_MENU_ITEMS = MENU_ITEMS.filter((item) => !item.alwaysVisible);

const emptyForm: AdminFormData = {
  name: '',
  email: '',
  password: '',
  role: 'admin',
};

export function AdminPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Permissions dialog state
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsAdmin, setPermissionsAdmin] = useState<Admin | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState<string | null>(null);

  // Admin permissions cache for Access column display
  const [adminPermissionsCache, setAdminPermissionsCache] = useState<Record<string, Record<string, boolean>>>({});

  // Fetch admins
  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admins');
      const json = await res.json();
      if (json.success) {
        const adminsList = json.data.admins || [];
        setAdmins(adminsList);
        // Fetch permissions for each regular admin
        for (const admin of adminsList.filter((a: Admin) => a.role === 'admin')) {
          fetchPermissionsForCache(admin.id);
        }
      } else {
        setAdmins([]);
      }
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch permissions for cache (Access column display)
  const fetchPermissionsForCache = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/menu-permissions?userId=${userId}`);
      const json = await res.json();
      if (json.success) {
        setAdminPermissionsCache((prev) => ({
          ...prev,
          [userId]: json.data.permissions || {},
        }));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchAdmins();
    }
  }, [user, fetchAdmins]);

  // Guard: only super_admin can access
  if (user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-slate-400 mt-2 max-w-md">
            You do not have permission to access this page. Only super admins can manage admin accounts.
          </p>
        </div>
      </div>
    );
  }

  // Filter admins by search
  const filteredAdmins = admins.filter((admin) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      admin.name.toLowerCase().includes(q) ||
      admin.email.toLowerCase().includes(q) ||
      admin.role.toLowerCase().includes(q)
    );
  });

  // Separate super admins and regular admins
  const superAdmins = filteredAdmins.filter(a => a.role === 'super_admin');
  const regularAdmins = filteredAdmins.filter(a => a.role === 'admin');

  // Open permissions dialog
  async function handlePermissions(admin: Admin) {
    setPermissionsAdmin(admin);
    setPermissionsLoading(true);
    setPermissionsDialogOpen(true);
    setPermissions({});

    try {
      const res = await fetch(`/api/menu-permissions?userId=${admin.id}`);
      const json = await res.json();
      if (json.success) {
        setPermissions(json.data.permissions || {});
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load permissions',
        variant: 'destructive',
      });
    } finally {
      setPermissionsLoading(false);
    }
  }

  // Toggle a menu permission
  async function handleTogglePermission(menuKey: string, allowed: boolean) {
    if (!permissionsAdmin) return;

    setPermissionsSaving(menuKey);
    // Optimistic update
    setPermissions((prev) => ({ ...prev, [menuKey]: allowed }));

    try {
      const res = await fetch('/api/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: permissionsAdmin.id,
          menuKey,
          allowed,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Permission Updated',
          description: `${TOGGLEABLE_MENU_ITEMS.find(m => m.key === menuKey)?.label || menuKey} access ${allowed ? 'granted' : 'revoked'} for ${permissionsAdmin.name}.`,
        });
        // Update cache
        setAdminPermissionsCache((prev) => ({
          ...prev,
          [permissionsAdmin.id]: { ...(prev[permissionsAdmin.id] || {}), [menuKey]: allowed },
        }));
      } else {
        // Revert on failure
        setPermissions((prev) => ({ ...prev, [menuKey]: !allowed }));
        toast({
          title: 'Error',
          description: json.error || 'Failed to update permission',
          variant: 'destructive',
        });
      }
    } catch {
      // Revert on failure
      setPermissions((prev) => ({ ...prev, [menuKey]: !allowed }));
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive',
      });
    } finally {
      setPermissionsSaving(null);
    }
  }

  // Get access label for an admin
  function getAccessLabel(admin: Admin) {
    const perms = adminPermissionsCache[admin.id] || {};
    const alwaysVisible = MENU_ITEMS.filter(m => m.alwaysVisible).map(m => m.label);
    const granted = TOGGLEABLE_MENU_ITEMS
      .filter(m => perms[m.key] === true)
      .map(m => m.label);
    const allAccess = [...alwaysVisible, ...granted];
    return allAccess.join(', ');
  }

  // Validate form
  function validateForm(data: AdminFormData, isEdit: boolean): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!data.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!data.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Invalid email format';
    }
    if (!isEdit && !data.password.trim()) {
      errors.password = 'Password is required';
    } else if (data.password && data.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    return errors;
  }

  // Open create dialog
  function handleCreate(defaultRole: 'admin' | 'super_admin' = 'admin') {
    setEditingAdmin(null);
    setFormData({ ...emptyForm, role: defaultRole });
    setFormErrors({});
    setDialogOpen(true);
  }

  // Open edit dialog
  function handleEdit(admin: Admin) {
    setEditingAdmin(admin);
    setFormData({ name: admin.name, email: admin.email, password: '', role: admin.role as 'admin' | 'super_admin' });
    setFormErrors({});
    setDialogOpen(true);
  }

  // Submit create/edit
  async function handleSubmit() {
    const isEdit = !!editingAdmin;
    const errors = validateForm(formData, isEdit);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Warn about creating super admin
    if (!isEdit && formData.role === 'super_admin') {
      const confirmed = window.confirm('Are you sure you want to create a Super Admin account? This user will have full system access including the ability to manage other admins.');
      if (!confirmed) return;
    }

    // Warn about changing role to super_admin
    if (isEdit && editingAdmin!.role !== 'super_admin' && formData.role === 'super_admin') {
      const confirmed = window.confirm('Are you sure you want to promote this user to Super Admin? They will gain full system access.');
      if (!confirmed) return;
    }

    // Warn about demoting super_admin
    if (isEdit && editingAdmin!.role === 'super_admin' && formData.role !== 'super_admin') {
      const otherSuperAdmins = admins.filter(a => a.role === 'super_admin' && a.id !== editingAdmin!.id);
      if (otherSuperAdmins.length === 0) {
        toast({
          title: 'Cannot Demote',
          description: 'There must be at least one Super Admin in the system.',
          variant: 'destructive',
        });
        return;
      }
      const confirmed = window.confirm('Are you sure you want to demote this Super Admin to a regular Admin? They will lose their elevated privileges.');
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      let res: Response;
      if (isEdit) {
        const body: Record<string, string> = { name: formData.name, email: formData.email, role: formData.role };
        if (formData.password.trim()) body.password = formData.password;
        res = await fetch(`/api/admins/${editingAdmin.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, requesterId: user?.id }),
        });
      }
      const json = await res.json();

      if (json.success) {
        toast({
          title: isEdit ? 'Account Updated' : 'Account Created',
          description: `${formData.name} has been ${isEdit ? 'updated' : 'created'} as ${formData.role === 'super_admin' ? 'Super Admin' : 'Admin'} successfully.`,
        });
        setDialogOpen(false);
        fetchAdmins();
      } else {
        toast({
          title: 'Error',
          description: json.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Open delete dialog
  function handleDelete(admin: Admin) {
    if (admin.role === 'super_admin') {
      const otherSuperAdmins = admins.filter(a => a.role === 'super_admin' && a.id !== admin.id);
      if (otherSuperAdmins.length === 0) {
        toast({
          title: 'Cannot Delete',
          description: 'There must be at least one Super Admin in the system. Promote another user first.',
          variant: 'destructive',
        });
        return;
      }
    }
    setDeletingAdmin(admin);
    setDeleteDialogOpen(true);
  }

  // Confirm delete
  async function confirmDelete() {
    if (!deletingAdmin) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admins/${deletingAdmin.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast({
          title: 'Account Deleted',
          description: `${deletingAdmin.name} has been removed successfully.`,
        });
        setDeleteDialogOpen(false);
        setDeletingAdmin(null);
        fetchAdmins();
      } else {
        toast({
          title: 'Error',
          description: json.error || 'Failed to delete account',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin Management</h2>
          <p className="text-slate-400 mt-1">
            Create and manage admin and super admin accounts for the system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Crown className="h-3 w-3 mr-1" />
            Super Admin
          </Badge>
          <Button
            onClick={() => handleCreate('super_admin')}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Crown className="h-4 w-4 mr-2" />
            Create Super Admin
          </Button>
          <Button
            onClick={() => handleCreate('admin')}
            className="bg-white hover:bg-gray-200 text-black"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Admin
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search admins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-white/30 focus:border-white/50"
        />
      </div>

      {/* Super Admins Section */}
      {superAdmins.length > 0 && (
        <Card className="bg-slate-800/50 border-amber-500/20 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              Super Admins
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 ml-2">
                {superAdmins.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-semibold">Name</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Email</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-center">Role</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Created</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {superAdmins.map((admin) => (
                    <TableRow key={admin.id} className="border-slate-700/50 hover:bg-slate-700/30">
                      <TableCell className="text-slate-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                            <Crown className="h-4 w-4 text-amber-400" />
                          </div>
                          {admin.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          {admin.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
                          Super Admin
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDate(admin.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(admin)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(admin)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Admins Section */}
      <Card className="bg-slate-800/50 border-slate-700/50 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <UserCog className="h-4 w-4 text-slate-400" />
            Admin Directory
            <Badge className="bg-white/10 text-white border-white/20 ml-2">
              {regularAdmins.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-700 rounded-lg" />
              ))}
            </div>
          ) : regularAdmins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700/50 mb-4">
                <Shield className="h-7 w-7 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No admins match your search' : 'No regular admins found'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Click "Create Admin" to add your first admin account.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-semibold">Name</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Email</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-center">Role</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Access</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Created</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularAdmins.map((admin) => (
                    <TableRow key={admin.id} className="border-slate-700/50 hover:bg-slate-700/30">
                      <TableCell className="text-slate-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                            <span className="text-sm font-semibold text-white">
                              {admin.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {admin.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          {admin.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                          Admin
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs max-w-[200px]">
                        <span className="line-clamp-2">{getAccessLabel(admin)}</span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDate(admin.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePermissions(admin)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                            title="Manage Permissions"
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Permissions</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(admin)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(admin)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {editingAdmin ? (
                <>
                  <Pencil className="h-4 w-4 text-white" />
                  Edit Account
                </>
              ) : formData.role === 'super_admin' ? (
                <>
                  <Crown className="h-4 w-4 text-amber-400" />
                  Create Super Admin
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-white" />
                  Create Admin
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingAdmin
                ? 'Update account details. Leave password blank to keep unchanged.'
                : formData.role === 'super_admin'
                ? 'Create a new Super Admin account with full system access.'
                : 'Create a new admin account with access to Dashboard and Uniform Registry only.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                Role <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'super_admin') => setFormData(f => ({ ...f, role: value }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-white" />
                      <span>Admin</span>
                      <span className="text-xs text-slate-400 ml-1">(Dashboard & Uniform Registry)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="super_admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span>Super Admin</span>
                      <span className="text-xs text-slate-400 ml-1">(Full access)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="admin-name" className="text-slate-300">
                Name <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="admin-name"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((f) => ({ ...f, name: e.target.value }));
                    if (formErrors.name) setFormErrors((fe) => ({ ...fe, name: '' }));
                  }}
                  className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-white/30 focus:border-white/50"
                />
              </div>
              {formErrors.name && (
                <p className="text-xs text-red-400">{formErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-slate-300">
                Email <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData((f) => ({ ...f, email: e.target.value }));
                    if (formErrors.email) setFormErrors((fe) => ({ ...fe, email: '' }));
                  }}
                  className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-white/30 focus:border-white/50"
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-red-400">{formErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-300">
                Password {editingAdmin ? '' : <span className="text-red-400">*</span>}
                {editingAdmin && (
                  <span className="text-slate-500 font-normal ml-1">(optional)</span>
                )}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="admin-password"
                  type="password"
                  placeholder={editingAdmin ? 'Leave blank to keep current' : 'Enter password (min 6 chars)'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData((f) => ({ ...f, password: e.target.value }));
                    if (formErrors.password) setFormErrors((fe) => ({ ...fe, password: '' }));
                  }}
                  className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-white/30 focus:border-white/50"
                />
              </div>
              {formErrors.password && (
                <p className="text-xs text-red-400">{formErrors.password}</p>
              )}
            </div>

            {/* Super Admin Warning */}
            {formData.role === 'super_admin' && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
                <div className="flex items-start gap-2">
                  <Crown className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Super Admin Privileges</p>
                    <p className="text-amber-400/80 text-xs mt-1">
                      This account will have full system access including managing other admins, creating super admins, and accessing all system features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Access Info */}
            {formData.role === 'admin' && !editingAdmin && (
              <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white">
                <div className="flex items-start gap-2">
                  <UserCog className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Admin Access</p>
                    <p className="text-white/60 text-xs mt-1">
                      This account will have access to Dashboard and Uniform Registry by default. You can grant additional menu access after creation using the Permissions button.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className={formData.role === 'super_admin' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-white hover:bg-gray-200 text-black'}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {editingAdmin ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                <>
                  {editingAdmin ? (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Update Account
                    </>
                  ) : (
                    <>
                      {formData.role === 'super_admin' ? (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          Create Super Admin
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Admin
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-white" />
              Menu Permissions
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Manage sidebar menu access for <span className="text-white font-medium">{permissionsAdmin?.name}</span>.
              Toggle switches to grant or revoke access to specific menus.
            </DialogDescription>
          </DialogHeader>

          {permissionsLoading ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-full bg-slate-700 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {/* Always Visible Section */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Always Visible
                </p>
                <div className="space-y-1">
                  {MENU_ITEMS.filter(m => m.alwaysVisible).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5">
                            <Icon className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-300">{item.label}</span>
                            <p className="text-[11px] text-slate-500">Visible to all admin users</p>
                          </div>
                        </div>
                        <Badge className="bg-white/10 text-slate-400 border-white/10 text-[10px]">
                          Always On
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-slate-700" />

              {/* Toggleable Section */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Configurable Access
                </p>
                <div className="space-y-1">
                  {TOGGLEABLE_MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isAllowed = permissions[item.key] === true;
                    const isSaving = permissionsSaving === item.key;

                    return (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                          isAllowed ? 'bg-white/5' : 'bg-slate-700/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            isAllowed ? 'bg-white/10' : 'bg-white/5'
                          }`}>
                            <Icon className={`h-4 w-4 ${isAllowed ? 'text-white' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${isAllowed ? 'text-white' : 'text-slate-400'}`}>
                              {item.label}
                            </span>
                            <p className={`text-[11px] ${isAllowed ? 'text-slate-400' : 'text-slate-600'}`}>
                              {isAllowed ? 'Access granted' : 'No access'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSaving && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          <Switch
                            checked={isAllowed}
                            onCheckedChange={(checked: boolean) => handleTogglePermission(item.key, checked)}
                            disabled={isSaving}
                            className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-600"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPermissionsDialogOpen(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete {deletingAdmin?.role === 'super_admin' ? 'Super Admin' : 'Admin'} Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete the {deletingAdmin?.role === 'super_admin' ? 'super admin' : 'admin'} account for{' '}
              <span className="text-white font-semibold">{deletingAdmin?.name}</span>? This action
              cannot be undone. The user will lose all access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              className="text-slate-400 hover:text-white hover:bg-slate-700 border-slate-700"
              disabled={deleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white focus:ring-red-500/30 focus:ring-offset-slate-800 border-0"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting...
                </span>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
