import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BellRing, Check, CreditCard, Home, Info, ListChecks, Plus, ReceiptText, Search, ShieldCheck, Sparkles, Utensils } from "lucide-react";
import { billApi } from "../api/bill";
import { getErrorMessage } from "../api/http";
import { menuApi } from "../api/menu";
import { orderApi } from "../api/order";
import { paymentApi } from "../api/payment";
import { sessionApi } from "../api/session";
import { suggestionApi } from "../api/suggestion";
import { useSessionSocket } from "../hooks/useSessionSocket";
import { useAppState } from "../state/AppContext";
import { initials, itemPayload, money, statusLabel } from "../utils/format";
import { uploadsUrl } from "../config";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "menu", label: "Menu", icon: Utensils },
  { id: "suggestions", label: "Suggest", icon: BellRing },
  { id: "orders", label: "Orders", icon: ListChecks },
  { id: "bill", label: "Bill", icon: ReceiptText },
];

const swatches = ["bg-rust", "bg-sage", "bg-gold", "bg-muted", "bg-ink"];

export default function CustomerShell() {
  const { qrToken, sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const {
    session,
    memberId,
    memberName,
    orders,
    setOrders,
    suggestions,
    setSuggestions,
    bill,
    setBill,
    payment,
    setPayment,
    realtimeNotice,
    setRealtimeNotice,
    saveSession,
    clearCustomer,
  } = state;

  const [screen, setScreen] = useState(routeSessionId || session ? "home" : "join");
  const [name, setName] = useState(memberName || "");
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drinkGateOpen, setDrinkGateOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("qr");
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailLoading, setItemDetailLoading] = useState(false);

  const activeSessionId = session?._id || routeSessionId;

  const refreshOrders = async () => {
    if (!activeSessionId) return;
    setOrders(await orderApi.bySession(activeSessionId));
  };
  const refreshSuggestions = async () => {
    if (!activeSessionId) return;
    setSuggestions(await suggestionApi.bySession(activeSessionId));
  };
  const refreshBill = async () => {
    if (!activeSessionId) return;
    try {
      setBill(await billApi.bySession(activeSessionId));
    } catch {
      setBill(null);
    }
  };
  const refreshSession = async () => {
    if (!activeSessionId) return;
    const next = await sessionApi.get(activeSessionId);
    saveSession(next);
  };
  const refreshPayments = async () => {
    if (!activeSessionId) return;
    const payments = await paymentApi.bySession(activeSessionId);
    setPayment(payments.find((item) => item.status !== "failed") || payments[0] || null);
  };

  useSessionSocket(activeSessionId, {
    orders: refreshOrders,
    bill: refreshBill,
    session: refreshSession,
  });

  useEffect(() => {
    if (routeSessionId && (!session || !session.restaurantName)) {
      sessionApi.get(routeSessionId).then((next) => saveSession(next)).catch(() => setError("Session not found"));
    }
  }, [routeSessionId, session?.restaurantName]);

  useEffect(() => {
    if (!session?.restaurantId) return;
    Promise.allSettled([
      menuApi.available(session.restaurantId),
      refreshOrders(),
      refreshSuggestions(),
      refreshBill(),
      refreshPayments(),
    ]).then(([menuResult]) => {
      if (menuResult.status === "fulfilled") setMenu(menuResult.value);
      else setError(getErrorMessage(menuResult.reason, "Could not load menu"));
    });
  }, [session?.restaurantId, activeSessionId]);

  useEffect(() => {
    if (session?.status === "closed" || bill?.status === "finalized" || payment?.status === "verified") {
      setScreen("payment");
    }
  }, [session?.status, bill?.status, payment?.status]);

  const cartItems = useMemo(
    () =>
      Object.values(cart).map(({ item, quantity }) => ({
        ...item,
        quantity,
        subtotal: quantity * Number(item.price || 0),
      })),
    [cart],
  );
  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const activeSuggestion = suggestions.find((item) => item.status === "pending");
  const members = session?.members || [];
  const restaurantName =
    session?.restaurantName ||
    session?.restaurant?.restaurantName ||
    session?.restaurantId?.restaurantName ||
    "DineSync";

  const filteredMenu = menu.filter((item) => {
    const inCategory = category === "all" || item.category === category;
    const matches = `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase());
    return inCategory && matches;
  });

  async function joinSession(event) {
    event.preventDefault();
    if (!qrToken) {
      setError("Open this page from a table QR link.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await sessionApi.join(qrToken, name.trim());
      saveSession(data.session, data.memberId, name.trim());
      setScreen("privacy");
      navigate(`/session/${data.session._id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not join session"));
    } finally {
      setLoading(false);
    }
  }

  function addToCart(item, delta) {
    setCart((prev) => {
      const key = item.cartKey || item._id;
      const nextQty = Math.max(0, (prev[key]?.quantity || 0) + delta);
      const next = { ...prev };
      if (!nextQty) delete next[key];
      else next[key] = { item, quantity: nextQty };
      return next;
    });
  }

  async function openItemDetails(item) {
    setItemDetailLoading(true);
    setError("");
    setScreen("itemDetails");
    try {
      setSelectedItem(await menuApi.get(item._id));
    } catch (err) {
      setSelectedItem(item);
      setError(getErrorMessage(err, "Could not load item details"));
    } finally {
      setItemDetailLoading(false);
    }
  }

  function addDetailedItem(item, quantity, allergens, specialInstructions) {
    const cartKey = `${item._id}:${allergens.join("|")}:${specialInstructions.trim()}`;
    addToCart({ ...item, cartKey, allergens, specialInstructions: specialInstructions.trim() }, quantity);
    setScreen("menu");
  }

  async function confirmOrder() {
    if (!cartItems.length) return;
    const hasDrink = cartItems.some((item) => item.category === "drinks");
    if (!hasDrink && !drinkGateOpen) {
      setDrinkGateOpen(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      for (const item of cartItems) {
        await orderApi.addItem(activeSessionId, memberId, itemPayload(item, item.quantity, item.specialInstructions, item.allergens));
      }
      setCart({});
      setDrinkGateOpen(false);
      await refreshOrders();
      setScreen("orders");
    } catch (err) {
      setError(getErrorMessage(err, "Could not place order"));
    } finally {
      setLoading(false);
    }
  }

  async function suggestItem(item) {
    setError("");
    try {
      const suggestion = await suggestionApi.create(activeSessionId, memberId, item._id);
      setSuggestions((prev) => [suggestion, ...prev.filter((old) => old._id !== suggestion._id)]);
      setRealtimeNotice({ type: "suggestion-created", title: "Suggestion started", payload: suggestion });
      setScreen("suggestions");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create suggestion"));
    }
  }

  async function voteSuggestion(suggestion, vote) {
    try {
      const updated = await suggestionApi.vote(suggestion._id, memberId, vote);
      setSuggestions((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err) {
      setError(getErrorMessage(err, "Could not vote"));
    }
  }

  async function generateBill() {
    setLoading(true);
    setError("");
    try {
      const next = bill ? await billApi.refresh(activeSessionId) : await billApi.generate(activeSessionId);
      setBill(next);
    } catch (err) {
      setError(getErrorMessage(err, "Could not generate bill"));
    } finally {
      setLoading(false);
    }
  }

  async function createPayment() {
    if (!bill?.billId) return;
    if (session?.status === "closed" || bill?.status === "finalized") {
      setScreen("payment");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await paymentApi.create(bill.billId, memberId, paymentMethod);
      setPayment(next);
      setScreen("payment");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create payment"));
    } finally {
      setLoading(false);
    }
  }

  if (screen === "join") {
    return (
      <main className="customer-app customer-entry">
        <section className="join-hero">
          <div className="brand">Dine<span>Sync</span></div>
          <div className="join-hero-copy">
            <span>Table ordering</span>
            <h1>Settle in. Your table is ready.</h1>
            <p>Join your group, browse the live menu, flag allergies, and send requests from your own phone.</p>
          </div>
          <div className="join-proof-row">
            <span><Check size={14} /> No app install</span>
            <span><Check size={14} /> Live table bill</span>
          </div>
        </section>
        <form className="join-card" onSubmit={joinSession}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" required />
          </label>
          {error && <div className="notice error">{error}</div>}
          <button className="primary-btn" disabled={loading}>{loading ? "Joining..." : "Join table"}</button>
          <p className="join-reassurance">No app install needed. Your order stays tied to this table session.</p>
        </form>
      </main>
    );
  }

  if (screen === "privacy") {
    return (
      <main className="customer-app customer-entry">
        <PrivacyScreen restaurantName={restaurantName} onContinue={() => setScreen("home")} />
      </main>
    );
  }

  return (
    <main className="customer-app">
      <CustomerTopBar
        title={screen === "payment" ? "Payment Status" : screen === "itemDetails" ? "Item Details" : restaurantName}
        subtitle={`Table ${session?.tableNumber || "-"} · ${members.length} members`}
        onBack={() => (screen === "payment" ? setScreen("bill") : screen === "itemDetails" ? setScreen("menu") : setScreen("home"))}
      />

      {error && <div className="notice error mx-5 mt-3">{error}</div>}

      <section className={`customer-scroll ${screen === "menu" ? "menu-scroll" : ""} ${cartItems.length > 0 && screen === "menu" ? "has-action-bar" : ""}`}>
        {screen === "home" && (
          <HomeScreen
            session={session}
            restaurantName={restaurantName}
            members={members}
            memberId={memberId}
            orders={orders}
            setScreen={setScreen}
          />
        )}
        {screen === "menu" && (
          <MenuScreen
            menu={filteredMenu}
            fullMenu={menu}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            cart={cart}
            addToCart={addToCart}
            openItemDetails={openItemDetails}
            suggestItem={suggestItem}
            activeSuggestion={activeSuggestion}
          />
        )}
        {screen === "itemDetails" && (
          <ItemDetailsScreen
            item={selectedItem}
            loading={itemDetailLoading}
            onAdd={addDetailedItem}
            onBack={() => setScreen("menu")}
          />
        )}
        {screen === "suggestions" && (
          <SuggestionsScreen
            suggestions={suggestions}
            members={members}
            memberId={memberId}
            voteSuggestion={voteSuggestion}
          />
        )}
        {screen === "orders" && (
          <OrdersScreen orders={orders} members={members} memberId={memberId} setScreen={setScreen} />
        )}
        {screen === "bill" && (
          <BillScreen
            bill={bill}
            members={members}
            orders={orders}
            memberId={memberId}
            payment={payment}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            generateBill={generateBill}
            createPayment={createPayment}
            loading={loading}
            sessionStatus={session?.status}
          />
        )}
        {screen === "payment" && (
          <PaymentStatusScreen
            payment={payment}
            bill={bill}
            session={session}
            onExit={() => {
              clearCustomer();
              window.location.href = "about:blank";
            }}
          />
        )}
      </section>

      {cartItems.length > 0 && screen === "menu" && (
        <div className="mobile-action-bar">
          <div>
            <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
            <strong>{money(cartTotal)}</strong>
          </div>
          <button onClick={confirmOrder} disabled={loading}>{loading ? "Sending..." : "Confirm order"}</button>
        </div>
      )}

      {screen !== "payment" && screen !== "itemDetails" && (
        <nav className="bottom-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={screen === tab.id ? "active" : ""} onClick={() => setScreen(tab.id)}>
                <Icon size={19} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {drinkGateOpen && (
        <DrinkNudge
          drinks={menu.filter((item) => item.category === "drinks").slice(0, 4)}
          onClose={() => setDrinkGateOpen(false)}
          onSeeDrinks={() => {
            setDrinkGateOpen(false);
            setCategory("drinks");
            setScreen("menu");
          }}
          onConfirmAnyway={() => {
            setDrinkGateOpen(false);
            setTimeout(confirmOrder, 0);
          }}
        />
      )}

      {realtimeNotice?.type?.startsWith("suggestion") && realtimeNotice.payload?.suggesterId !== memberId && (
        <SuggestionModal
          notice={realtimeNotice}
          members={members}
          memberId={memberId}
          onClose={() => setRealtimeNotice(null)}
          onVote={(vote) => voteSuggestion(realtimeNotice.payload, vote)}
        />
      )}
    </main>
  );
}

function CustomerTopBar({ title, subtitle, onBack }) {
  return (
    <header className="customer-top">
      <button onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function PrivacyScreen({ restaurantName, onContinue }) {
  return (
    <section className="privacy-screen">
      <div className="privacy-orb"><ShieldCheck size={46} /></div>
      <div className="privacy-copy">
        <span>{restaurantName}</span>
        <h1>Your privacy is safe with us.</h1>
        <p>DineSync only uses your table session details to place orders, keep your group in sync, and close the bill.</p>
      </div>
      <div className="privacy-points">
        <span><Check size={15} /> No app install required</span>
        <span><Check size={15} /> Your session stays tied to this table</span>
        <span><Check size={15} /> Allergy flags and requests go only to the order</span>
      </div>
      <button className="primary-btn" onClick={onContinue}>Continue to menu</button>
    </section>
  );
}

function HomeScreen({ session, restaurantName, members, memberId, orders, setScreen }) {
  const itemCount = orders.reduce((sum, order) => sum + (order.itemCount || order.items?.length || 0), 0);

  return (
    <div>
      <section className="customer-hero">
        <div className="restaurant-kicker">{restaurantName}</div>
        <div className="eyebrow">Table {session?.tableNumber} · Live session</div>
        <h2>Welcome back,<br /><span>order at your pace.</span></h2>
        <div className="hero-status-row">
          <span>{members.length} guests seated</span>
          <span>{itemCount} items ordered</span>
        </div>
        <div className="member-row">
          {members.map((member, index) => (
            <div key={member.memberId} className={`member-chip ${member.memberId === memberId ? "you" : ""}`}>
              <span className={swatches[index % swatches.length]}>{initials(member.name)}</span>
              {member.memberId === memberId ? "You" : member.name}
            </div>
          ))}
        </div>
      </section>
      <div className="action-grid">
        <button className="feature-card full" onClick={() => setScreen("menu")}><Utensils size={20} />Browse Menu<span>Explore dishes, allergies, and requests before adding.</span></button>
        <button className="feature-card" onClick={() => setScreen("suggestions")}><BellRing size={18} />Suggestions<span>Vote live with the table.</span></button>
        <button className="feature-card" onClick={() => setScreen("orders")}><ListChecks size={18} />Orders<span>See what everyone ordered.</span></button>
      </div>
      <SectionTitle title="Group order so far" />
      <OrderPreview orders={orders.slice(0, 4)} members={members} />
    </div>
  );
}

function MenuScreen({ menu, fullMenu, category, setCategory, search, setSearch, cart, addToCart, openItemDetails, suggestItem, activeSuggestion }) {
  const counts = {
    all: fullMenu.length,
    mains: fullMenu.filter((item) => item.category === "mains").length,
    starters: fullMenu.filter((item) => item.category === "starters").length,
    drinks: fullMenu.filter((item) => item.category === "drinks").length,
  };
  return (
    <div className="menu-screen">
      <div className="menu-controls">
        <div className="search-wrap">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu..." />
        </div>
        <div className="category-tabs">
          {["all", "mains", "starters", "drinks"].map((item) => (
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
              {item}<span>{counts[item]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="menu-list">
        {menu.length > 0 && <FeaturedItem item={menu.find((item) => item.isPopular) || menu[0]} />}
        <SectionTitle title={category === "all" ? "Menu" : category} />
        {menu.map((item) => (
          <MenuCard
            key={item._id}
            item={item}
            quantity={cart[item._id]?.quantity || 0}
            onAdd={() => addToCart(item, 1)}
            onRemove={() => addToCart(item, -1)}
            onDetails={() => openItemDetails(item)}
            onSuggest={() => suggestItem(item)}
            canSuggest={!activeSuggestion}
          />
        ))}
        {!menu.length && <EmptyState title="No items here" text="Try another category or search term." />}
      </div>
    </div>
  );
}

function FeaturedItem({ item }) {
  return (
    <div className="featured-item">
      <div className="food-thumb"><Sparkles size={22} /></div>
      <div>
        <span>Most ordered today</span>
        <strong>{item.name}</strong>
        <p>{item.description}</p>
      </div>
      <b>{money(item.price)}</b>
    </div>
  );
}

function MenuCard({ item, quantity, onAdd, onRemove, onDetails, onSuggest, canSuggest }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDetails();
    }
  };

  return (
    <article className="menu-card-react" role="button" tabIndex={0} onClick={onDetails} onKeyDown={handleKeyDown}>
      <div className="menu-photo">
        {item.imageUrl ? <img src={uploadsUrl(item.imageUrl)} alt="" /> : <Utensils size={22} />}
      </div>
      <div className="menu-card-content">
        <div className="menu-card-title">
          <h3>{item.name}</h3>
          <strong>{money(item.price)}</strong>
        </div>
        <p>{item.description || "Tap to view ingredients, allergy flags, and requests."}</p>
        <div className="menu-card-actions">
          <button className="suggest-btn" onClick={(event) => { event.stopPropagation(); onSuggest(); }} disabled={!canSuggest}>
            <BellRing size={14} /> Suggest
          </button>
          {item.isPopular && <span className="popular-pill">Popular</span>}
          <span className="detail-hint"><Info size={13} /> Details</span>
        </div>
      </div>
      <div className="qty-control compact" onClick={(event) => event.stopPropagation()}>
        {quantity > 0 && <button onClick={onRemove} aria-label={`Remove ${item.name}`}>-</button>}
        {quantity > 0 && <span>{quantity}</span>}
        <button onClick={onAdd} aria-label={`Add ${item.name}`}><Plus size={18} /></button>
      </div>
    </article>
  );
}

function ItemDetailsScreen({ item, loading, onAdd, onBack }) {
  const [quantity, setQuantity] = useState(1);
  const [allergens, setAllergens] = useState([]);
  const [customAllergens, setCustomAllergens] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    setQuantity(1);
    setAllergens([]);
    setCustomAllergens("");
    setSpecialInstructions("");
  }, [item?._id]);

  if (loading && !item) return <EmptyState title="Loading item" text="Fetching the latest menu details." />;
  if (!item) return <EmptyState title="Item unavailable" text="Go back to the menu and choose another item." />;

  const commonAllergens = item.commonAllergens || [];
  const customAllergenList = customAllergens.split(",").map((allergen) => allergen.trim()).filter(Boolean);
  const selectedAllergens = Array.from(new Set([...allergens, ...customAllergenList]));
  const toggleAllergen = (allergen) => {
    setAllergens((prev) => (prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]));
  };

  return (
    <div className="pb-28">
      <section className="item-detail-hero">
        {item.imageUrl ? <img src={uploadsUrl(item.imageUrl)} alt="" /> : <div className="food-thumb"><Utensils size={30} /></div>}
        <div>
          <span>{item.category}</span>
          <h2>{item.name}</h2>
          <strong>{money(item.price)}</strong>
        </div>
      </section>
      <div className="item-detail-body">
        <p>{item.description || "No description added yet."}</p>
        <div className="detail-block">
          <h3>Allergy flags</h3>
          {commonAllergens.length ? (
            <div className="allergen-grid">
              {commonAllergens.map((allergen) => (
                <button key={allergen} className={allergens.includes(allergen) ? "active" : ""} onClick={() => toggleAllergen(allergen)}>
                  {allergen}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-text">No common allergens listed for this item.</p>
          )}
          <input
            className="allergen-input"
            value={customAllergens}
            onChange={(event) => setCustomAllergens(event.target.value)}
            placeholder="Add your own, comma separated: sesame, kiwi"
          />
          {selectedAllergens.length > 0 && (
            <div className="selected-allergens">
              {selectedAllergens.map((allergen) => <span key={allergen}>{allergen}</span>)}
            </div>
          )}
        </div>
        <label className="detail-block">
          <h3>Special request</h3>
          <textarea
            value={specialInstructions}
            onChange={(event) => setSpecialInstructions(event.target.value)}
            placeholder="Example: less spicy, sauce on the side, no onions"
          />
        </label>
        <div className="detail-actions">
          <div className="qty-control">
            <button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity((value) => value + 1)}>+</button>
          </div>
          <button className="primary-btn" onClick={() => onAdd(item, quantity, selectedAllergens, specialInstructions)}>
            Add {quantity} - {money(Number(item.price || 0) * quantity)}
          </button>
        </div>
        <button className="text-btn" onClick={onBack}>Back to menu</button>
      </div>
    </div>
  );
}

function SuggestionsScreen({ suggestions, members, memberId, voteSuggestion }) {
  if (!suggestions.length) return <EmptyState title="No suggestions yet" text="Suggest a menu item after someone places an order." />;
  return (
    <div className="pb-24">
      {suggestions.map((suggestion) => (
        <SuggestionCard key={suggestion._id} suggestion={suggestion} members={members} memberId={memberId} onVote={voteSuggestion} />
      ))}
    </div>
  );
}

function SuggestionCard({ suggestion, members, memberId, onVote }) {
  const yesVotes = suggestion.votes?.filter((vote) => vote.vote).length || 0;
  const voted = suggestion.votes?.some((vote) => vote.memberId === memberId);
  const percent = Math.min(100, (yesVotes / Math.max(1, suggestion.requiredVotes)) * 100);
  return (
    <article className={`suggestion-card ${suggestion.status}`}>
      <div className="suggestion-head">
        <span>{suggestion.status === "pending" ? "Live vote" : statusLabel(suggestion.status)}</span>
        <small>{yesVotes}/{suggestion.requiredVotes} yes</small>
      </div>
      <h3>{suggestion.menuItemName}</h3>
      <p>{money(suggestion.menuItemPrice)} · suggested for the table</p>
      <div className="vote-track"><span style={{ width: `${percent}%` }} /></div>
      <div className="suggestion-voters">
        {members.map((member, index) => {
          const vote = suggestion.votes?.find((item) => item.memberId === member.memberId);
          return <span key={member.memberId} className={`${swatches[index % swatches.length]} ${vote ? "voted" : ""}`}>{initials(member.name)}</span>;
        })}
      </div>
      {suggestion.status === "pending" && !voted && (
        <div className="vote-actions">
          <button onClick={() => onVote(suggestion, true)}>Vote yes</button>
          <button onClick={() => onVote(suggestion, false)}>No thanks</button>
        </div>
      )}
    </article>
  );
}

function OrdersScreen({ orders, members, memberId, setScreen }) {
  return (
    <div className="pb-24">
      <div className="orders-pay-action">
        <button className="primary-btn" onClick={() => setScreen("bill")}>Ready to pay</button>
      </div>
      <SectionTitle title="Live orders" />
      {orders.map((order) => {
        const owner = members.find((member) => member.memberId === order.memberId);
        return (
          <article key={order._id} className={`order-card ${order.memberId === memberId ? "mine" : ""}`}>
            <div>
              <h3>{owner?.name || order.memberId}</h3>
              <OrderItemList items={order.items} />
              {order.sharedItems?.length > 0 && (
                <div className="shared-order-list">
                  <strong>Shared items</strong>
                  <OrderItemList items={order.sharedItems} status={order.status} />
                </div>
              )}
            </div>
            <div><strong>{money(order.totalAmount)}</strong><span>{statusLabel(order.status)}</span></div>
          </article>
        );
      })}
      {!orders.length && <EmptyState title="No orders yet" text="Your table order appears here as people confirm." />}
    </div>
  );
}

function OrderItemList({ items = [], status }) {
  if (!items.length) return <p>No items</p>;
  return (
    <div className="order-item-list">
      {items.map((item, index) => (
        <div key={`${item.menuItemId || item.name}-${index}`}>
          <p>{item.name} x{item.quantity}{status ? ` · ${statusLabel(status)}` : ""}</p>
          {item.allergens?.length > 0 && <small>Allergy: {item.allergens.join(", ")}</small>}
          {item.specialInstructions && <small>Request: {item.specialInstructions}</small>}
        </div>
      ))}
    </div>
  );
}

function BillScreen({ bill, members, orders, memberId, payment, paymentMethod, setPaymentMethod, generateBill, createPayment, loading, sessionStatus }) {
  const total = bill?.totalAmount || orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const isClosed = sessionStatus === "closed" || bill?.status === "finalized" || payment?.status === "verified";
  return (
    <div className="pb-28">
      <section className="bill-hero-react">
        <span>Table bill</span>
        <h2>{money(total)}</h2>
        <p>{members.length} people · one person pays after everyone reviews</p>
      </section>
      {!bill && <button className="primary-btn mx-5 mt-4" onClick={generateBill} disabled={loading}>{loading ? "Generating..." : "Generate bill"}</button>}
      {bill && (
        <>
          <SectionTitle title="Personal items" />
          {bill.items?.personal?.map((person) => {
            const member = members.find((item) => item.memberId === person.memberId);
            return (
              <article key={person.memberId} className={`split-card ${person.memberId === memberId ? "mine" : ""}`}>
                <div><strong>{member?.name || person.memberId}{person.memberId === memberId ? " (you)" : ""}</strong><p>{person.items.map((item) => item.name).join(", ") || "No personal items"}</p></div>
                <b>{money(person.total)}</b>
              </article>
            );
          })}
          <SectionTitle title="Shared items" />
          <div className="soft-panel mx-5">
            {bill.items?.shared?.length ? bill.items.shared.map((item) => (
              <div className="line-row" key={`${item.menuItemId}-${item.name}`}><span>{item.name} x{item.quantity}</span><strong>{money(item.subtotal)}</strong></div>
            )) : <p className="muted-text">No shared items yet.</p>}
          </div>
          <SectionTitle title="Per-member breakdown" />
          {bill.perMember?.map((person) => {
            const member = members.find((item) => item.memberId === person.memberId);
            return (
              <article key={person.memberId} className="breakdown-card">
                <strong>{member?.name || person.memberId}</strong>
                <span>Own {money(person.ownItemsTotal)}</span>
                <span>Shared {money(person.sharedShare)}</span>
                <b>{money(person.finalAmount)}</b>
              </article>
            );
          })}
          <div className="pay-panel">
            <p>Only one person pays the full session bill. Restaurant staff verifies it manually.</p>
            <div className="method-row">
              {["qr", "cash", "card"].map((method) => (
                <button key={method} className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}>
                  <CreditCard size={16} />{method.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="primary-btn" onClick={createPayment} disabled={loading || payment?.status === "pending_verification" || isClosed}>
              {isClosed ? "Payment complete" : payment?.status === "pending_verification" ? "Waiting for verification" : `Pay full bill · ${money(bill.totalAmount)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PaymentStatusScreen({ payment, bill, session, onExit }) {
  const verified = payment?.status === "verified" || bill?.status === "finalized" || session?.status === "closed";
  return (
    <div className="payment-status">
      <div className={verified ? "success-ring" : "waiting-ring"}>{verified ? "✓" : "…"}</div>
      <h2>{verified ? "Payment verified" : "Waiting for verification"}</h2>
      <p>{verified ? "The bill is finalized and this dining session is closed." : "Restaurant staff will verify the payment shortly."}</p>
      <div className="receipt-mini">
        <span>Status</span><strong>{statusLabel(payment?.status || "pending_verification")}</strong>
        <span>Amount</span><strong>{money(payment?.amount || bill?.totalAmount)}</strong>
        <span>Method</span><strong>{payment?.method?.toUpperCase() || "-"}</strong>
      </div>
      {verified && <button className="primary-btn success-exit-btn" onClick={onExit}>Close / Exit Session</button>}
    </div>
  );
}

function DrinkNudge({ drinks, onClose, onSeeDrinks, onConfirmAnyway }) {
  return (
    <div className="modal-backdrop">
      <section className="suggestion-modal drink-nudge-modal">
        <span>Quick suggestion</span>
        <h2>Want something to drink?</h2>
        <p>Nobody has added drinks yet. You can add one now or keep the order moving.</p>
        <div className="drink-grid">
          {drinks.map((drink) => <button key={drink._id} onClick={onSeeDrinks}>{drink.name}<span>{money(drink.price)}</span></button>)}
        </div>
        <div className="drink-nudge-actions">
          <button className="primary-btn" onClick={onSeeDrinks}>View drinks menu</button>
          <button onClick={onConfirmAnyway}>Continue without adding</button>
        </div>
        <button className="text-btn" onClick={onClose}>Go back</button>
      </section>
    </div>
  );
}

function SuggestionModal({ notice, members, memberId, onClose, onVote }) {
  const suggestion = notice.payload;
  const voted = suggestion.votes?.some((vote) => vote.memberId === memberId);
  return (
    <div className="modal-backdrop">
      <section className="suggestion-modal">
        <span>Live table suggestion</span>
        <h2>{suggestion.menuItemName}</h2>
        <p>{money(suggestion.menuItemPrice)} · needs {suggestion.requiredVotes} yes votes</p>
        <div className="member-row light">
          {members.map((member, index) => <span key={member.memberId} className={swatches[index % swatches.length]}>{initials(member.name)}</span>)}
        </div>
        {!voted && suggestion.status === "pending" ? (
          <div className="vote-actions">
            <button onClick={() => onVote(true)}>Vote yes</button>
            <button onClick={() => onVote(false)}>No thanks</button>
          </div>
        ) : <button className="primary-btn" onClick={onClose}>View suggestions</button>}
        <button className="text-btn" onClick={onClose}>Dismiss</button>
      </section>
    </div>
  );
}

function SectionTitle({ title }) {
  return <div className="section-title-react"><span>{title}</span></div>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state-react"><h3>{title}</h3><p>{text}</p></div>;
}

function OrderPreview({ orders, members }) {
  if (!orders.length) return <EmptyState title="Quiet table so far" text="Orders will appear here in real time." />;
  return (
    <div className="px-5">
      {orders.map((order) => {
        const member = members.find((item) => item.memberId === order.memberId);
        return (
          <div className="preview-row" key={order._id}>
            <span>{initials(member?.name || "M")}</span>
            <div><strong>{member?.name || order.memberId}</strong><p>{order.itemCount} items</p></div>
            <b>{money(order.totalAmount)}</b>
          </div>
        );
      })}
    </div>
  );
}
