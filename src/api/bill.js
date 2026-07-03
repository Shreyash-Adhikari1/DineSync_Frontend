import { http } from "./http";

export const billApi = {
  generate: async (sessionId) => {
    const { data } = await http.post(`/api/bill/${sessionId}/generate`);
    return data.bill;
  },
  bySession: async (sessionId) => {
    const { data } = await http.get(`/api/bill/session/${sessionId}`);
    return data.bill;
  },
  refresh: async (sessionId) => {
    const { data } = await http.patch(`/api/bill/${sessionId}/refresh`);
    return data.bill;
  },
};
