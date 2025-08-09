'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { authService, User, UserCreate, UserUpdate } from '../services/auth';
import { CampaignManagement } from './CampaignManagement';
import { useToast } from './ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<UserCreate>({
        username: '',
        email: '',
        password: '',
        role: 'viewer',
    });
    const { toast } = useToast();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const userList = await authService.getUsers();
            setUsers(userList);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load users",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async () => {
        try {
            await authService.createUser(formData);
            toast({
                title: "Success",
                description: "User created successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadUsers();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create user",
                variant: "destructive",
            });
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        try {
            const updateData: UserUpdate = {
                username: formData.username,
                email: formData.email,
                role: formData.role,
            };

            if (formData.password) {
                updateData.password = formData.password;
            }

            await authService.updateUser(editingUser.id, updateData);
            toast({
                title: "Success",
                description: "User updated successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            loadUsers();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update user",
                variant: "destructive",
            });
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await authService.deleteUser(userId);
            toast({
                title: "Success",
                description: "User deleted successfully",
            });
            loadUsers();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete user",
                variant: "destructive",
            });
        }
    };

    const resetForm = () => {
        setFormData({
            username: '',
            email: '',
            password: '',
            role: 'viewer',
        });
        setEditingUser(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            email: user.email,
            password: '',
            role: user.role,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingUser) {
            handleUpdateUser();
        } else {
            handleCreateUser();
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="users">User Management</TabsTrigger>
                    <TabsTrigger value="campaigns">Campaign Management</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">User Management</h2>
                            <p className="text-zinc-600 dark:text-zinc-400">Manage application users and permissions</p>
                        </div>
                        <Button onClick={openCreateDialog} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                            Add User
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading users...</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {users.map((user) => (
                                <Card key={user.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div>
                                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {user.username}
                                                    </h3>
                                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                                        {user.role}
                                                    </Badge>
                                                    <Badge variant={user.is_active ? 'default' : 'destructive'}>
                                                        {user.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditDialog(user)}
                                                    className="border-zinc-200 dark:border-zinc-700"
                                                >
                                                    Edit
                                                </Button>
                                                {user.id !== authService.getCurrentUser()?.id && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <DialogHeader>
                                <DialogTitle className="text-zinc-900 dark:text-zinc-100">
                                    {editingUser ? 'Edit User' : 'Create User'}
                                </DialogTitle>
                                <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                                    {editingUser ? 'Update user information' : 'Add a new user to the system'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-zinc-700 dark:text-zinc-300">Username</Label>
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
                                        {editingUser ? 'Password (leave blank to keep current)' : 'Password'}
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-zinc-700 dark:text-zinc-300">Role</Label>
                                    <Select value={formData.role} onValueChange={(value: 'admin' | 'viewer') => setFormData({ ...formData, role: value })}>
                                        <SelectTrigger className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex justify-end space-x-2 pt-4">
                                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-200 dark:border-zinc-700">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSubmit} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                        {editingUser ? 'Update' : 'Create'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                <TabsContent value="campaigns" className="space-y-6">
                    <CampaignManagement />
                </TabsContent>
            </Tabs>
        </div>
    );
}
