import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LogOut, QrCode, RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { billApi } from "../api/bill";
import { businessApi } from "../api/business";
import { getErrorMessage } from "../api/http";
import { menuApi } from "../api/menu";
import { orderApi } from "../api/order";
import { paymentApi } from "../api/payment";
import { restaurantApi } from "../api/restaurant";
import { sessionApi } from "../api/session";
import { tableApi } from "../api/table";
import { money, statusLabel } from "../utils/format";
import { SOCKET_BASE_URL, uploadsUrl } from "../config";

const navItems = ["Overview", "Tables", "Menu", "Orders", "Bills & Payments"];

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("dinesync_business_token");
  const socketRef = useRef(null);
  const [active, setActive] = useState("Overview");
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [ordersBySession, setOrdersBySession] = useState({});
  const [billsBySession, setBillsBySession] = useState({});
  const [paymentsBySession, setPaymentsBySession] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) return <Navigate to="/business/login" replace />;

  async function loadRestaurants() {
    const items = await restaurantApi.own();
    setRestaurants(items);
    setRestaurantId((current) => current || items[0]?._id || "");
  }

  async function loadWorkspace(nextRestaurantId = restaurantId) {
    if (!nextRestaurantId) return;
    setLoading(true);
    setError("");
    try {
      const [nextTables, nextMenu, nextSessions] = await Promise.all([
        tableApi.list(nextRestaurantId),
        menuApi.list(nextRestaurantId),
        sessionApi.byRestaurant(nextRestaurantId),
      ]);
      setTables(nextTables);
      setMenu(nextMenu);
      setSessions(nextSessions);

      const orderEntries = await Promise.all(
        nextSessions.map(async (session) => [session._id, await orderApi.bySession(session._id)]),
      );
      setOrdersBySession(Object.fromEntries(orderEntries));

      const billEntries = await Promise.all(
        nextSessions.map(async (session) => {
          try {
            return [session._id, await billApi.bySession(session._id)];
          } catch {
            return [session._id, null];
          }
        }),
      );
      setBillsBySession(Object.fromEntries(billEntries));

      const paymentEntries = await Promise.all(
        nextSessions.map(async (session) => [session._id, await paymentApi.bySession(session._id)]),
      );
      setPaymentsBySession(Object.fromEntries(paymentEntries));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load dashboard"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRestaurants().catch((err) => setError(getErrorMessage(err, "Could not load restaurants")));
  }, []);

  useEffect(() => {
    if (restaurantId) loadWorkspace(restaurantId);
  }, [restaurantId]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_BASE_URL, { withCredentials: true });
    socketRef.current = socket;

    const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || value;

    socket.on("order-updated", (order) => {
      const sessionId = idOf(order?.sessionId);
      if (!sessionId) return;

      setOrdersBySession((prev) => {
        const sessionOrders = prev[sessionId] || [];
        const exists = sessionOrders.some((item) => item._id === order._id);
        return {
          ...prev,
          [sessionId]: exists
            ? sessionOrders.map((item) => (item._id === order._id ? order : item))
            : [order, ...sessionOrders],
        };
      });
    });

    socket.on("order-cancelled", ({ orderId, sessionId }) => {
      const roomId = idOf(sessionId);
      if (!roomId) return;
      setOrdersBySession((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter((order) => order._id !== orderId),
      }));
    });

    socket.on("order-status-changed", ({ orderId, status, sessionId }) => {
      const roomId = idOf(sessionId);
      if (!roomId) return;
      setOrdersBySession((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((order) => (order._id === orderId ? { ...order, status } : order)),
      }));
    });

    socket.on("bill-generated", (bill) => {
      const sessionId = idOf(bill?.sessionId);
      if (!sessionId) return;
      setBillsBySession((prev) => ({ ...prev, [sessionId]: bill }));
    });

    socket.on("bill-finalized", (bill) => {
      const sessionId = idOf(bill?.sessionId);
      if (!sessionId) return;
      setBillsBySession((prev) => ({ ...prev, [sessionId]: bill }));
    });

    socket.on("payment-created", (payment) => {
      const sessionId = idOf(payment?.sessionId);
      if (!sessionId) return;

      setPaymentsBySession((prev) => {
        const sessionPayments = prev[sessionId] || [];
        const exists = sessionPayments.some((item) => item._id === payment._id);
        return {
          ...prev,
          [sessionId]: exists
            ? sessionPayments.map((item) => (item._id === payment._id ? payment : item))
            : [payment, ...sessionPayments],
        };
      });
    });

    const updatePayment = (payment) => {
      const sessionId = idOf(payment?.sessionId);
      if (!sessionId) return;
      setPaymentsBySession((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).map((item) => (item._id === payment._id ? payment : item)),
      }));
    };

    socket.on("payment-verified", updatePayment);
    socket.on("payment-failed", updatePayment);

    socket.on("session-closed", ({ session, sessionId } = {}) => {
      const closedSessionId = idOf(session?._id || sessionId);
      if (!closedSessionId) return;
      setSessions((prev) =>
        prev.map((item) => (item._id === closedSessionId ? { ...item, ...(session || {}), status: "closed" } : item)),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    sessions.forEach((session) => socket.emit("join-session", session._id));
  }, [sessions]);

  function logout() {
    businessApi.logout();
    navigate("/business/login");
  }

  const currentRestaurant = restaurants.find((item) => item._id === restaurantId);
  const activeSessions = sessions.filter((session) => session.status === "active");
  const pendingPayments = Object.values(paymentsBySession).flat().filter((payment) => payment?.status === "pending_verification");

  return (
    <main className="business-app">
      <aside className="business-sidebar">
        <div className="brand dark">Dine<span>Sync</span></div>
        <nav>
          {navItems.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}>{item}</button>)}
        </nav>
        <button className="logout-btn" onClick={logout}><LogOut size={16} /> Logout</button>
      </aside>

      <section className="business-main">
        <header className="business-header">
          <div>
            <h1>{active}</h1>
            <p>{currentRestaurant?.restaurantName || "Create or select a restaurant"}</p>
          </div>
          <div className="business-tools">
            <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => <option key={restaurant._id} value={restaurant._id}>{restaurant.restaurantName}</option>)}
            </select>
            <button onClick={() => loadWorkspace()}><RefreshCw size={16} /> Refresh</button>
          </div>
        </header>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}

        {active === "Overview" && (
          <Overview
            restaurants={restaurants}
            setRestaurants={setRestaurants}
            loadRestaurants={loadRestaurants}
            tables={tables}
            menu={menu}
            activeSessions={activeSessions}
            pendingPayments={pendingPayments}
            setMessage={setMessage}
            setError={setError}
          />
        )}
        {active === "Tables" && (
          <TablesPanel restaurantId={restaurantId} tables={tables} reload={loadWorkspace} setMessage={setMessage} setError={setError} />
        )}
        {active === "Menu" && (
          <MenuPanel restaurantId={restaurantId} menu={menu} reload={loadWorkspace} setMessage={setMessage} setError={setError} />
        )}
        {active === "Orders" && (
          <OrdersPanel sessions={sessions} ordersBySession={ordersBySession} reload={loadWorkspace} setError={setError} />
        )}
        {active === "Bills & Payments" && (
          <BillsPanel
            sessions={sessions}
            billsBySession={billsBySession}
            paymentsBySession={paymentsBySession}
            reload={loadWorkspace}
            setMessage={setMessage}
            setError={setError}
          />
        )}
        {loading && <div className="loading-line">Loading latest data...</div>}
      </section>
    </main>
  );
}

function Overview({ restaurants, loadRestaurants, tables, menu, activeSessions, pendingPayments, setMessage, setError }) {
  return (
    <div className="dash-grid">
      <StatCard title="Tables" value={tables.length} />
      <StatCard title="Menu items" value={menu.length} />
      <StatCard title="Active sessions" value={activeSessions.length} />
      <StatCard title="Pending payments" value={pendingPayments.length} />
      <RestaurantForm loadRestaurants={loadRestaurants} setMessage={setMessage} setError={setError} />
      <div className="dash-card">
        <h2>Your restaurants</h2>
        {restaurants.map((restaurant) => <div className="line-row" key={restaurant._id}><span>{restaurant.restaurantName}</span><strong>{restaurant.restaurantPhoneNumber}</strong></div>)}
      </div>
    </div>
  );
}

function RestaurantForm({ loadRestaurants, setMessage, setError }) {
  const [form, setForm] = useState({ restaurantName: "", restaurantDescription: "", restaurantAddress: "", restaurantPhoneNumber: "" });
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  async function submit(event) {
    event.preventDefault();
    try {
      await restaurantApi.create(form);
      setForm({ restaurantName: "", restaurantDescription: "", restaurantAddress: "", restaurantPhoneNumber: "" });
      await loadRestaurants();
      setMessage("Restaurant created.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create restaurant"));
    }
  }
  return (
    <form className="dash-card form-grid" onSubmit={submit}>
      <h2>Create restaurant</h2>
      <input placeholder="Restaurant name" value={form.restaurantName} onChange={(e) => setField("restaurantName", e.target.value)} required />
      <input placeholder="Phone" value={form.restaurantPhoneNumber} onChange={(e) => setField("restaurantPhoneNumber", e.target.value)} />
      <input placeholder="Address" value={form.restaurantAddress} onChange={(e) => setField("restaurantAddress", e.target.value)} />
      <textarea placeholder="Description" value={form.restaurantDescription} onChange={(e) => setField("restaurantDescription", e.target.value)} />
      <button className="primary-btn">Create</button>
    </form>
  );
}

function TablesPanel({ restaurantId, tables, reload, setMessage, setError }) {
  const [form, setForm] = useState({ tableName: "", tableCapacity: 4 });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ tableName: "", tableCapacity: 4 });
  async function submit(event) {
    event.preventDefault();
    try {
      await tableApi.create(restaurantId, { tableName: form.tableName, tableCapacity: Number(form.tableCapacity) });
      setForm({ tableName: "", tableCapacity: 4 });
      await reload();
      setMessage("Table created with QR code.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create table"));
    }
  }
  function startEdit(table) {
    setEditingId(table._id);
    setEditForm({ tableName: table.tableName || "", tableCapacity: table.tableCapacity || 1 });
  }
  async function saveTable(event) {
    event.preventDefault();
    try {
      await tableApi.update(editingId, { tableName: editForm.tableName, tableCapacity: Number(editForm.tableCapacity) });
      setEditingId("");
      await reload();
      setMessage("Table updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not update table"));
    }
  }
  async function deleteTable(table) {
    if (!window.confirm(`Delete ${table.tableName || `Table ${table.tableNumber}`}?`)) return;
    try {
      await tableApi.remove(table._id);
      await reload();
      setMessage("Table deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete table"));
    }
  }
  return (
    <div className="panel-stack">
      <form className="dash-card form-inline" onSubmit={submit}>
        <input placeholder="Table name" value={form.tableName} onChange={(e) => setForm({ ...form, tableName: e.target.value })} required />
        <input type="number" min="1" value={form.tableCapacity} onChange={(e) => setForm({ ...form, tableCapacity: e.target.value })} />
        <button className="primary-btn">Add table</button>
      </form>
      <div className="table-grid">
        {tables.map((table) => (
          <article className="dash-card table-card" key={table._id}>
            <div><QrCode size={18} /><h3>Table {table.tableNumber}</h3></div>
            {editingId === table._id ? (
              <form className="admin-edit-form" onSubmit={saveTable}>
                <input placeholder="Table name" value={editForm.tableName} onChange={(e) => setEditForm({ ...editForm, tableName: e.target.value })} required />
                <input type="number" min="1" value={editForm.tableCapacity} onChange={(e) => setEditForm({ ...editForm, tableCapacity: e.target.value })} />
                <div>
                  <button>Save</button>
                  <button type="button" onClick={() => setEditingId("")}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <p>{table.tableName} · {table.tableCapacity} seats</p>
                <img src={table.qrCode} alt={`QR for ${table.tableName}`} />
                <small>{table.qrToken}</small>
                <div className="admin-card-actions">
                  <button onClick={() => startEdit(table)}>Edit</button>
                  <button className="danger-btn" onClick={() => deleteTable(table)}>Delete</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function MenuPanel({ restaurantId, menu, reload, setMessage, setError }) {
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "mains", commonAllergens: "", image: null });
  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      await menuApi.create(restaurantId, {
        ...form,
        price: Number(form.price),
        commonAllergens: form.commonAllergens.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm({ name: "", description: "", price: "", category: "mains", commonAllergens: "", image: null });
      formElement.reset();
      await reload();
      setMessage("Menu item added.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not add menu item"));
    }
  }
  return (
    <div className="panel-stack">
      <form className="dash-card menu-form" onSubmit={submit}>
        <h2>Add menu item</h2>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="mains">Mains</option>
          <option value="starters">Starters</option>
          <option value="drinks">Drinks</option>
        </select>
        <input placeholder="Allergens comma separated" value={form.commonAllergens} onChange={(e) => setForm({ ...form, commonAllergens: e.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] })} required />
        <button className="primary-btn">Add item</button>
      </form>
      <div className="menu-admin-grid">
        {menu.map((item) => <MenuAdminCard key={item._id} item={item} restaurantId={restaurantId} reload={reload} setMessage={setMessage} setError={setError} />)}
      </div>
    </div>
  );
}

function MenuAdminCard({ item, restaurantId, reload, setMessage, setError }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: item.name || "",
    description: item.description || "",
    price: item.price || "",
    category: item.category || "mains",
    commonAllergens: (item.commonAllergens || []).join(", "),
    image: null,
  });
  async function toggleAvailability() {
    try {
      await menuApi.toggleAvailability(restaurantId, item._id);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update availability"));
    }
  }
  async function togglePopular() {
    try {
      await menuApi.togglePopular(restaurantId, item._id);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update popularity"));
    }
  }
  async function saveItem(event) {
    event.preventDefault();
    try {
      await menuApi.update(restaurantId, item._id, {
        ...form,
        price: Number(form.price),
        commonAllergens: form.commonAllergens.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setEditing(false);
      await reload();
      setMessage("Menu item updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not update menu item"));
    }
  }
  async function deleteItem() {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await menuApi.remove(restaurantId, item._id);
      await reload();
      setMessage("Menu item deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete menu item"));
    }
  }
  return (
    <article className="dash-card menu-admin-card">
      {item.imageUrl ? <img src={uploadsUrl(item.imageUrl)} alt="" /> : <div className="admin-placeholder">🍽</div>}
      {editing ? (
        <form className="admin-edit-form" onSubmit={saveItem}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="mains">Mains</option>
            <option value="starters">Starters</option>
            <option value="drinks">Drinks</option>
          </select>
          <input placeholder="Allergens comma separated" value={form.commonAllergens} onChange={(e) => setForm({ ...form, commonAllergens: e.target.value })} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] })} />
          <div>
            <button>Save item</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h3>{item.name}</h3>
          <p>{item.category} · {money(item.price)}</p>
          {item.commonAllergens?.length > 0 && <small>Allergens: {item.commonAllergens.join(", ")}</small>}
          <div className="admin-card-actions">
            <button onClick={toggleAvailability}>{item.isAvailable ? "Mark unavailable" : "Mark available"}</button>
            <button onClick={togglePopular}>{item.isPopular ? "Unpopular" : "Popular"}</button>
            <button onClick={() => setEditing(true)}>Edit</button>
            <button className="danger-btn" onClick={deleteItem}>Delete</button>
          </div>
        </>
      )}
    </article>
  );
}

function OrdersPanel({ sessions, ordersBySession, reload, setError }) {
  async function changeStatus(order) {
    try {
      if (order.status === "ordered") await orderApi.startCooking(order._id);
      else if (order.status === "cooking") await orderApi.markCooked(order._id);
      else if (order.status === "ready") await orderApi.markServed(order._id);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update order status"));
    }
  }
  return (
    <div className="panel-stack">
      {sessions.map((session) => (
        <div className="dash-card" key={session._id}>
          <h2>Table {session.tableNumber} · {statusLabel(session.status)}</h2>
          {(ordersBySession[session._id] || []).map((order) => (
            <div className="order-admin-row" key={order._id}>
              <div>
                <strong>{order.orderCode}</strong>
                <BusinessOrderItems items={order.items} />
                {order.sharedItems?.length > 0 && (
                  <div className="shared-admin-items">
                    <small>Shared items · {statusLabel(order.status)}</small>
                    <BusinessOrderItems items={order.sharedItems} />
                  </div>
                )}
              </div>
              <span>{money(order.totalAmount)}</span>
              <button disabled={order.status === "served" || order.status === "cancelled"} onClick={() => changeStatus(order)}>
                {order.status === "ordered" ? "Start cooking" : order.status === "cooking" ? "Mark cooked" : order.status === "ready" ? "Mark served" : statusLabel(order.status)}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BusinessOrderItems({ items = [] }) {
  if (!items.length) return <p>No items</p>;
  return (
    <div className="business-order-items">
      {items.map((item, index) => (
        <div className="business-order-item" key={`${item.menuItemId || item.name}-${index}`}>
          <p><strong>{item.name}</strong><span>x{item.quantity}</span></p>
          {item.allergens?.length > 0 && (
            <div className="business-order-flags allergy">
              <b>Allergy</b>
              {item.allergens.map((allergen) => <span key={allergen}>{allergen}</span>)}
            </div>
          )}
          {item.specialInstructions && (
            <div className="business-order-flags request">
              <b>Request</b>
              <span>{item.specialInstructions}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BillsPanel({ sessions, billsBySession, paymentsBySession, reload, setMessage, setError }) {
  async function generate(sessionId, hasBill) {
    try {
      if (hasBill) await billApi.refresh(sessionId);
      else await billApi.generate(sessionId);
      await reload();
      setMessage("Bill updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not update bill"));
    }
  }
  async function verify(paymentId) {
    try {
      await paymentApi.verify(paymentId);
      await reload();
      setMessage("Payment verified. Bill finalized and session closed.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not verify payment"));
    }
  }
  async function fail(paymentId) {
    try {
      await paymentApi.fail(paymentId, "Marked failed from dashboard");
      await reload();
      setMessage("Payment marked failed.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not fail payment"));
    }
  }
  return (
    <div className="panel-stack">
      {sessions.map((session) => {
        const bill = billsBySession[session._id];
        const payments = paymentsBySession[session._id] || [];
        return (
          <div className="dash-card" key={session._id}>
            <div className="bill-admin-head">
              <div><h2>Table {session.tableNumber}</h2><p>{statusLabel(session.status)}</p></div>
              <button onClick={() => generate(session._id, Boolean(bill))}>{bill ? "Refresh bill" : "Generate bill"}</button>
            </div>
            {bill && <div className="line-row"><span>{bill.billCode} · {statusLabel(bill.status)}</span><strong>{money(bill.totalAmount)}</strong></div>}
            {payments.map((payment) => (
              <div className="payment-admin-row" key={payment._id}>
                <div><strong>{money(payment.amount)} · {payment.method?.toUpperCase()}</strong><p>{statusLabel(payment.status)} by {payment.payerMemberId}</p></div>
                {payment.status === "pending_verification" && <><button onClick={() => verify(payment._id)}>Verify</button><button onClick={() => fail(payment._id)}>Fail</button></>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ title, value }) {
  return <article className="dash-card stat-card"><span>{title}</span><strong>{value}</strong></article>;
}
