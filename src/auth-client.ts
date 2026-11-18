export type NovaRole = 'Admin' | 'Regular';
export interface NovaUser {
  id: number;
  name: string;
  email: string;
  username: string;
  mfa_enabled: boolean;
  role: NovaRole;
  must_change_password: boolean;
}
export type AuthResponse = { user: NovaUser };
export type UsersResponse = { users: NovaUser[] };

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers
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
export function signIn(email: string, password: string, code = ""): Promise<AuthResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST', body: JSON.stringify({email, password, code})
  });
}
export function getSession(): Promise<AuthResponse> {
  return apiRequest('/api/auth/me');
}
export function rotateInitialPassword(currentPassword: string,newPassword: string): Promise<{ok:boolean;reauthenticate:boolean}> {
  return apiRequest('/api/auth/change-password', {
    method: 'POST', body: JSON.stringify({currentPassword,newPassword})
  });
}
export function fetchUsers(): Promise<UsersResponse> {
  return apiRequest('/api/users');
}
export function provisionUser(name: string,email: string,password: string,username?: string): Promise<{user:NovaUser}> {
  return apiRequest('/api/users',{
    method: 'POST', body: JSON.stringify({name,email,password,username})
  });
}
export function signOut(): Promise<{ok:boolean}> {
  return apiRequest('/api/auth/logout',{method:'POST',body:'{}'});
}

export interface DirectMessage { id: number; sender: number; text: string; created_at: string; }
export interface CalendarEvent { id: number; title: string; date: string; time: string; duration: number; attendees: string[]; link: string; type: string; }
export function getMessages(peer: number): Promise<{messages: DirectMessage[]}> {
  return apiRequest('/api/messages?peer=' + encodeURIComponent(String(peer)));
}
export function postMessage(peer: number, text: string): Promise<{message: DirectMessage}> {
  return apiRequest('/api/messages?peer=' + encodeURIComponent(String(peer)), {method:'POST',body:JSON.stringify({text})});
}
export function getCalendarEvents(): Promise<{events: CalendarEvent[]}> {
  return apiRequest('/api/calendar');
}
export function postCalendarEvent(event: {title:string;date:string;time:string;duration:number}): Promise<{event: CalendarEvent}> {
  return apiRequest('/api/calendar',{method:'POST',body:JSON.stringify(event)});
}
