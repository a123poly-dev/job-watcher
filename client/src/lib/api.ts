const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (password: string) => req('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  me: () => req<{ authenticated: boolean }>('/auth/me'),

  // Sites
  getSites: () => req<Site[]>('/sites'),
  getSite: (id: number) => req<Site>(`/sites/${id}`),
  createSite: (data: { name: string; url: string; renderMode?: string }) =>
    req<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  updateSite: (id: number, data: Partial<Site>) =>
    req<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSite: (id: number) => req(`/sites/${id}`, { method: 'DELETE' }),
  previewSite: (data: { url: string }) =>
    req<{ listings: { title: string; url: string }[]; renderMode: string }>('/sites/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  checkSiteNow: (id: number) => req(`/sites/${id}/check`, { method: 'POST' }),
  getSiteListings: (id: number) => req<SeenListing[]>(`/sites/${id}/listings`),

  // Filters
  createFilter: (data: { siteId: number; keyword: string; recipientId: number }) =>
    req<Filter>('/filters', { method: 'POST', body: JSON.stringify(data) }),
  updateFilter: (id: number, data: Partial<Filter>) =>
    req<Filter>(`/filters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFilter: (id: number) => req(`/filters/${id}`, { method: 'DELETE' }),

  // Recipients
  getRecipients: () => req<Recipient[]>('/recipients'),
  createRecipient: (data: { label: string; email: string }) =>
    req<Recipient>('/recipients', { method: 'POST', body: JSON.stringify(data) }),
  deleteRecipient: (id: number) => req(`/recipients/${id}`, { method: 'DELETE' }),
  sendTestEmail: (email: string) =>
    req('/recipients/test-email', { method: 'POST', body: JSON.stringify({ email }) }),

  // Logs
  getActivityLog: () => req<ActivityLogEntry[]>('/logs/activity'),
  getNotificationLog: () => req<NotificationLogEntry[]>('/logs/notifications'),
};

export interface Site {
  id: number;
  name: string;
  url: string;
  listSelector: string;
  titleSelector: string;
  linkSelector: string;
  renderMode: string;
  checkIntervalMinutes?: number;
  lastCheckedAt?: string;
  lastStatus?: string;
  createdAt: string;
  archivedAt?: string;
  filters?: Filter[];
}

export interface Filter {
  id: number;
  siteId: number;
  keyword: string;
  recipientId: number;
  isActive: boolean;
  createdAt: string;
  archivedAt?: string;
  recipient?: Recipient;
}

export interface Recipient {
  id: number;
  label: string;
  email: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: number;
  type: string;
  detail: string;
  createdAt: string;
}

export interface SeenListing {
  id: number;
  siteId: number;
  fingerprint: string;
  title: string;
  url: string;
  firstSeenAt: string;
  isBaseline: boolean;
}

export interface NotificationLogEntry {
  id: number;
  filterId: number;
  listingTitle: string;
  listingUrl: string;
  sentToEmail: string;
  sentAt: string;
  success: boolean;
  filter?: { site?: { name: string } };
}
