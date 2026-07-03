import { http } from "./http";

export const sessionApi = {
  join: async (qrToken, name) => {
    const { data } = await http.post(`/api/sessions/join/${qrToken}`, { name });
    return data;
  },
  get: async (sessionId) => {
    const { data } = await http.get(`/api/sessions/${sessionId}`);
    return data.session;
  },
  activeByTable: async (tableId) => {
    const { data } = await http.get(`/api/sessions/table/${tableId}/active`);
    return data.session;
  },
  byRestaurant: async (restaurantId) => {
    const { data } = await http.get(`/api/sessions/restaurant/${restaurantId}`);
    return data.sessions;
  },
};
