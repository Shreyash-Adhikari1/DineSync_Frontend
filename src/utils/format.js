export const money = (value = 0) =>
  `Rs. ${Number(value || 0).toLocaleString("en-NP", {
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  })}`;

export const initials = (name = "?") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export const statusLabel = (status = "") =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const itemPayload = (item, quantity = 1, specialInstructions = "", allergens = undefined) => ({
  menuItemId: item._id,
  name: item.name,
  price: Number(item.price || 0),
  quantity,
  allergens: allergens ?? item.allergens ?? item.commonAllergens ?? [],
  specialInstructions,
});
