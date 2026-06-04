import { api } from "./client";

export interface AuthState {
  authenticated: boolean;
  auth_required: boolean;
  username: string | null;
}

export const getAuthState = () =>
  api.get<AuthState>("/api/auth/me").then(r => r.data);

export const login = (username: string, password: string) =>
  api
    .post<{ username: string }>("/api/auth/login", { username, password })
    .then(r => r.data);

export const logout = () => api.post("/api/auth/logout").then(r => r.data);
