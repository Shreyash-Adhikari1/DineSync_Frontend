import { createContext, useContext, useMemo, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = sessionStorage.getItem("dinesync_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [memberId, setMemberId] = useState(() => sessionStorage.getItem("dinesync_member_id") || "");
  const [memberName, setMemberName] = useState(() => sessionStorage.getItem("dinesync_member_name") || "");
  const [orders, setOrders] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [bill, setBill] = useState(null);
  const [payment, setPayment] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState(null);

  const saveSession = (nextSession, nextMemberId, nextName) => {
    setSession(nextSession);
    sessionStorage.setItem("dinesync_session", JSON.stringify(nextSession));
    if (nextMemberId) {
      setMemberId(nextMemberId);
      sessionStorage.setItem("dinesync_member_id", nextMemberId);
    }
    if (nextName) {
      setMemberName(nextName);
      sessionStorage.setItem("dinesync_member_name", nextName);
    }
  };

  const clearCustomer = () => {
    sessionStorage.removeItem("dinesync_session");
    sessionStorage.removeItem("dinesync_member_id");
    sessionStorage.removeItem("dinesync_member_name");
    setSession(null);
    setMemberId("");
    setMemberName("");
    setOrders([]);
    setSuggestions([]);
    setBill(null);
    setPayment(null);
  };

  const value = useMemo(
    () => ({
      session,
      setSession,
      memberId,
      setMemberId,
      memberName,
      setMemberName,
      orders,
      setOrders,
      suggestions,
      setSuggestions,
      bill,
      setBill,
      payment,
      setPayment,
      socketConnected,
      setSocketConnected,
      realtimeNotice,
      setRealtimeNotice,
      saveSession,
      clearCustomer,
    }),
    [session, memberId, memberName, orders, suggestions, bill, payment, socketConnected, realtimeNotice],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppProvider");
  return context;
}
