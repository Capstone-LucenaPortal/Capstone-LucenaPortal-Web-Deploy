import type { StoredRequest } from './types';

const REQUESTS_KEY = 'requests';

export const requestService = {
  getRequests(): StoredRequest[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(REQUESTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as StoredRequest[];
    } catch {
      localStorage.removeItem(REQUESTS_KEY);
      return [];
    }
  },

  addRequest(req: Omit<StoredRequest, 'id' | 'date'>): StoredRequest {
    const requests = requestService.getRequests();
    const newReq: StoredRequest = {
      ...req,
      id: `REQ-${Date.now()}`,
      date: new Date().toISOString(),
    };
    requests.push(newReq);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    return newReq;
  },

  updateRequest(bookingNumber: string, updates: Partial<StoredRequest>): boolean {
    const requests = requestService.getRequests();
    let matched = false;
    const updated = requests.map(r => {
      if (r.bookingNumber === bookingNumber) {
        matched = true;
        return { ...r, ...updates };
      }
      return r;
    });
    if (!matched) return false;
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
    return true;
  },
};
