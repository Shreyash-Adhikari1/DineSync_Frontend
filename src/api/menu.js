import { http } from "./http";

export const menuApi = {
  list: async (restaurantId) => {
    const { data } = await http.get(`/api/menu/restaurant/${restaurantId}`);
    return data.menu;
  },
  available: async (restaurantId) => {
    const { data } = await http.get(`/api/menu/restaurant/${restaurantId}/available`);
    return data.menu;
  },
  get: async (menuItemId) => {
    const { data } = await http.get(`/api/menu/item/${menuItemId}`);
    return data.menuItem;
  },
  create: async (restaurantId, payload) => {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "image") form.append("menu-item", value);
      else if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
      else form.append(key, value);
    });
    const { data } = await http.post(`/api/menu/restaurant/${restaurantId}`, form);
    return data.menuItem;
  },
  update: async (restaurantId, menuItemId, payload) => {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (key === "image") form.append("menu-item", value);
      else if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
      else form.append(key, value);
    });
    const { data } = await http.patch(`/api/menu/restaurant/${restaurantId}/${menuItemId}`, form);
    return data.menuItem;
  },
  remove: async (restaurantId, menuItemId) => {
    const { data } = await http.delete(`/api/menu/restaurant/${restaurantId}/${menuItemId}`);
    return data;
  },
  toggleAvailability: async (restaurantId, menuItemId) => {
    const { data } = await http.patch(`/api/menu/restaurant/${restaurantId}/${menuItemId}/availability`);
    return data.menuItem;
  },
  togglePopular: async (restaurantId, menuItemId) => {
    const { data } = await http.patch(`/api/menu/restaurant/${restaurantId}/${menuItemId}/popularity`);
    return data.menuItem;
  },
};
