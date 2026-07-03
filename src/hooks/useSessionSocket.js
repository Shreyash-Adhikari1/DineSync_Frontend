import { useEffect } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE_URL } from "../config";
import { useAppState } from "../state/AppContext";

export function useSessionSocket(sessionId, refreshers = {}) {
  const {
    setSocketConnected,
    setSession,
    setOrders,
    setSuggestions,
    setBill,
    setPayment,
    setRealtimeNotice,
  } = useAppState();

  useEffect(() => {
    if (!sessionId) return undefined;

    const socket = io(SOCKET_BASE_URL, { withCredentials: true });

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join-session", sessionId);
    });

    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("member-joined", (member) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members?.some((m) => m.memberId === member.memberId)
                ? prev.members
                : [...(prev.members || []), member],
            }
          : prev,
      );
      setRealtimeNotice({ type: "member", title: "Someone joined", payload: member });
    });

    socket.on("order-updated", (order) => {
      setOrders((prev) => {
        const exists = prev.some((item) => item._id === order._id);
        return exists ? prev.map((item) => (item._id === order._id ? order : item)) : [order, ...prev];
      });
      refreshers.orders?.();
    });
    socket.on("order-cancelled", ({ orderId }) => {
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    });
    socket.on("order-status-changed", ({ orderId, status }) => {
      setOrders((prev) => prev.map((order) => (order._id === orderId ? { ...order, status } : order)));
    });
    socket.on("drink-suggestion", (payload) => {
      setRealtimeNotice({ type: "drink", title: "Drink nudge", payload });
    });

    const upsertSuggestion = (suggestion, type) => {
      setSuggestions((prev) => {
        const exists = prev.some((item) => item._id === suggestion._id);
        return exists ? prev.map((item) => (item._id === suggestion._id ? suggestion : item)) : [suggestion, ...prev];
      });
      setRealtimeNotice({ type, title: "Group suggestion", payload: suggestion });
    };

    socket.on("suggestion-created", (suggestion) => upsertSuggestion(suggestion, "suggestion-created"));
    socket.on("suggestion-updated", (suggestion) => upsertSuggestion(suggestion, "suggestion-updated"));
    socket.on("suggestion-approved", (suggestion) => upsertSuggestion(suggestion, "suggestion-approved"));
    socket.on("suggestion-rejected", (suggestion) => upsertSuggestion(suggestion, "suggestion-rejected"));
    socket.on("suggestion-expired", (suggestion) => upsertSuggestion(suggestion, "suggestion-expired"));

    socket.on("bill-generated", (nextBill) => {
      setBill(nextBill);
      setRealtimeNotice({ type: "bill", title: "Bill generated", payload: nextBill });
      refreshers.bill?.();
    });
    socket.on("bill-finalized", (nextBill) => {
      setBill(nextBill);
      setRealtimeNotice({ type: "bill-finalized", title: "Bill finalized", payload: nextBill });
      refreshers.session?.();
    });

    socket.on("payment-created", (nextPayment) => {
      setPayment(nextPayment);
      setRealtimeNotice({ type: "payment-created", title: "Payment requested", payload: nextPayment });
    });
    socket.on("payment-verified", (nextPayment) => {
      setPayment(nextPayment);
      setRealtimeNotice({ type: "payment-verified", title: "Payment verified", payload: nextPayment });
      refreshers.session?.();
      refreshers.bill?.();
    });
    socket.on("payment-failed", (nextPayment) => {
      setPayment(nextPayment);
      setRealtimeNotice({ type: "payment-failed", title: "Payment failed", payload: nextPayment });
    });

    socket.on("session-closed", ({ session } = {}) => {
      setSession((prev) => {
        const nextSession = session || (prev ? { ...prev, status: "closed" } : prev);
        if (nextSession) sessionStorage.setItem("dinesync_session", JSON.stringify(nextSession));
        return nextSession;
      });
      setRealtimeNotice({ type: "session-closed", title: "Session closed" });
    });

    return () => socket.disconnect();
  }, [sessionId]);
}
