import { http } from "./http";

export const paymentApi = {
  create: async (billId, payerMemberId, method) => {
    const { data } = await http.post("/api/payment", {
      billId,
      payerMemberId,
      method,
    });
    return data.payment;
  },
  bySession: async (sessionId) => {
    const { data } = await http.get(`/api/payment/session/${sessionId}`);
    return data.payments;
  },
  verify: async (paymentId) => {
    const { data } = await http.patch(`/api/payment/verify/${paymentId}`);
    return data.payment;
  },
  fail: async (paymentId, notes) => {
    const { data } = await http.patch(`/api/payment/fail/${paymentId}`, { notes });
    return data.payment;
  },
};
