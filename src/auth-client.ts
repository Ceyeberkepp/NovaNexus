export type NovaRole = 'Admin' | 'Regular';
export interface NovaUser {
  id: number;
  name: string;
  email: string;
  role: NovaRole;
  must_change_password: boolean;
}
export type AuthResponse = { user: NovaUser };
export type UsersResponse = { users: NovaUser[] };

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null &&
      'error' in body && typeof body.error === 'string'
      ? body.error : 'Request failed';
    throw new Error(message);
  }
  return body as T;
}
export function signIn(email: string, password: string, setupCode: string): Promise<AuthResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST', body: JSON.stringify({email, password, setupCode})
  });
}
export function getSession(): Promise<AuthResponse> {
  return apiRequest('/api/auth/me');
}
export function rotateInitialPassword(currentPassword: string,newPassword: string,setupCode: string): Promise<{ok:boolean;reauthenticate:boolean}> {
  return apiRequest('/api/auth/change-password', {
    method: 'POST', body: JSON.stringify({currentPassword,newPassword,setupCode})
  });
}
export function fetchUsers(): Promise<UsersResponse> {
  return apiRequest('/api/users');
}
export function provisionUser(name: string,email: string,password: string): Promise<{user:NovaUser}> {
  return apiRequest('/api/users',{
    method: 'POST', body: JSON.stringify({name,email,password})
  });
}
export function signOut(): Promise<{ok:boolean}> {
  return apiRequest('/api/auth/logout',{method:'POST',body:'{}'});
}
