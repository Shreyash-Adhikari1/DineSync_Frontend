import { http } from "./http";

export const businessApi = {
  login: async (email, password) => {
    const { data } = await http.post("/api/business/login", { email, password });
    localStorage.setItem("dinesync_business_token", data.token);
    localStorage.setItem("dinesync_business", JSON.stringify(data.business));
    return data;
  },
  register: async (payload) => {
    const { data } = await http.post("/api/business/register", payload);
    return data.business;
  },
  logout: () => {
    localStorage.removeItem("dinesync_business_token");
    localStorage.removeItem("dinesync_business");
  },
};
