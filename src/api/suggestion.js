import { http } from "./http";

export const suggestionApi = {
  create: async (sessionId, memberId, menuItemId) => {
    const { data } = await http.post(`/api/suggestion/${sessionId}`, {
      memberId,
      menuItemId,
    });
    return data.suggestion;
  },
  vote: async (suggestionId, memberId, vote) => {
    const { data } = await http.post(`/api/suggestion/vote/${suggestionId}`, {
      memberId,
      vote,
    });
    return data.suggestion;
  },
  bySession: async (sessionId) => {
    const { data } = await http.get(`/api/suggestion/session/${sessionId}`);
    return data.suggestions;
  },
};
