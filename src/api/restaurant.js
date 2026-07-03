import { http } from "./http";

export const restaurantApi = {
  own: async () => {
    const { data } = await http.get("/api/restaurants/own");
    return data.restaurants;
  },
  create: async (payload) => {
    const { data } = await http.post("/api/restaurants", payload);
    return data.restaurant;
  },
  update: async (restaurantId, payload) => {
    const { data } = await http.patch(`/api/restaurants/${restaurantId}`, payload);
    return data.restaurant;
  },
  remove: async (restaurantId) => {
    const { data } = await http.delete(`/api/restaurants/${restaurantId}`);
    return data;
  },
};
