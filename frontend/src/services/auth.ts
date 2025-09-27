/**
 * Authentication service for user login, logout, and management
 */
import {getApiUrl} from "@/utils/api";

const API_BASE_URL = getApiUrl();

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'viewer';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface UserCreate {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'viewer';
}

export interface UserUpdate {
    username?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'viewer';
    is_active?: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: User;
}

class AuthService {

    private token: string | null = null;
    private user: User | null = null;

    constructor() {
        // Load token from localStorage on initialization
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('auth_token');
            const userStr = localStorage.getItem('auth_user');
            if (userStr) {
                try {
                    this.user = JSON.parse(userStr);
                } catch (e) {
                    console.error('Failed to parse stored user:', e);
                }
            }
        }
    }

    /**
     * Login with username and password
     */
    async login(credentials: LoginCredentials): Promise<User> {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data: AuthResponse = await response.json();

        // Store token and user data
        this.token = data.access_token;
        this.user = data.user;

        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('auth_user', JSON.stringify(this.user));
        }

        return this.user;
    }

    /**
     * Logout current user
     */
    logout(): void {
        this.token = null;
        this.user = null;

        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
        }
    }

    /**
     * Get current user
     */
    getCurrentUser(): User | null {
        return this.user;
    }

    /**
     * Get current token
     */
    getToken(): string | null {
        return this.token;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.token !== null && this.user !== null;
    }

    /**
     * Check if user is admin
     */
    isAdmin(): boolean {
        return this.user?.role === 'admin';
    }

    /**
     * Get authorization header for API requests
     */
    getAuthHeader(): { Authorization: string } | {} {
        return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    }

    /**
     * Get all users (admin only)
     */
    async getUsers(): Promise<User[]> {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
                ...this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch users');
        }

        return response.json();
    }

    /**
     * Create a new user (admin only)
     */
    async createUser(userData: UserCreate): Promise<User> {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                ...this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create user');
        }

        return response.json();
    }

    /**
     * Update a user (admin only)
     */
    async updateUser(userId: number, userData: UserUpdate): Promise<User> {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
            method: 'PUT',
            headers: {
                ...this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update user');
        }

        return response.json();
    }

    /**
     * Delete a user (admin only)
     */
    async deleteUser(userId: number): Promise<void> {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
            method: 'DELETE',
            headers: this.getAuthHeader(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete user');
        }
    }

    /**
     * Get current user info
     */
    async getCurrentUserInfo(): Promise<User> {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: this.getAuthHeader(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch user info');
        }

        const user = await response.json();
        this.user = user;

        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_user', JSON.stringify(this.user));
        }

        return user;
    }
}

// Export singleton instance
export const authService = new AuthService();
