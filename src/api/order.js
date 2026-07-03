import { http } from "./http";

export const orderApi = {
  addItem: async (sessionId, memberId, item) => {
    const { data } = await http.post(`/api/order/${sessionId}/add-item`, {
      memberId,
      item,
    });
    return data.order;
  },
  bySession: async (sessionId) => {
    const { data } = await http.get(`/api/order/session/${sessionId}`);
    return data.orders;
  },
  byMember: async (sessionId, memberId) => {
    const { data } = await http.get(`/api/order/session/${sessionId}/member/${memberId}`);
    return data.orders;
  },
  startCooking: async (orderId) => {
    const { data } = await http.patch(`/api/order/${orderId}/start-cooking`);
    return data.order;
  },
  markCooked: async (orderId) => {
    const { data } = await http.patch(`/api/order/${orderId}/mark-cooked`);
    return data.order;
  },
  markServed: async (orderId) => {
    const { data } = await http.patch(`/api/order/${orderId}/mark-served`);
    return data.order;
  },
};
