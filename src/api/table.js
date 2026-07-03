import { http } from "./http";

export const tableApi = {
  list: async (restaurantId) => {
    const { data } = await http.get(`/api/tables/restaurant/${restaurantId}`);
    return data.tables;
  },
  create: async (restaurantId, payload) => {
    const { data } = await http.post(`/api/tables/restaurant/${restaurantId}`, payload);
    return data.table;
  },
  update: async (tableId, payload) => {
    const { data } = await http.patch(`/api/tables/${tableId}`, payload);
    return data.table;
  },
  remove: async (tableId) => {
    const { data } = await http.delete(`/api/tables/${tableId}`);
    return data;
  },
};
