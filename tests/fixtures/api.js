export const API_URL = "http://localhost:5000";

export const testSession = {
  _id: "session-test-1",
  restaurantId: "restaurant-test-1",
  tableId: "table-test-1",
  tableNumber: 7,
  restaurantName: "Playwright Bistro",
  status: "active",
  members: [{ memberId: "MEM_test", name: "Asha" }],
};

export const testRestaurant = {
  _id: "restaurant-test-1",
  restaurantName: "Playwright Bistro",
  restaurantDescription: "A mocked restaurant for frontend tests",
  restaurantAddress: "Kathmandu",
  restaurantPhoneNumber: "9800000000",
};

export const testTable = {
  _id: "table-test-1",
  restaurantId: "restaurant-test-1",
  tableNumber: 7,
  tableName: "Window Table",
  tableCapacity: 4,
  qrToken: "qr-token-test",
  qrCode: "data:image/png;base64,test",
  isActive: true,
};

export const testMenu = [
  {
    _id: "menu-test-1",
    restaurantId: "restaurant-test-1",
    name: "Steamed Momo",
    description: "Fresh dumplings",
    price: 250,
    category: "mains",
    imageUrl: "momo.png",
    isAvailable: true,
    isPopular: true,
    commonAllergens: ["gluten"],
  },
];

export async function mockFrontendApi(page) {
  await page.route(`${API_URL}/api/business/login`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        token: "frontend-test-token",
        business: {
          _id: "business-test-1",
          businessName: "Playwright Owner",
          email: "owner@test.local",
          role: "business",
        },
      }),
    });
  });

  await page.route(`${API_URL}/api/business/register`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        business: {
          _id: "business-test-1",
          businessName: "Playwright Owner",
          email: "owner@test.local",
        },
      }),
    });
  });

  await page.route(`${API_URL}/api/sessions/join/qr-token-test`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        session: testSession,
        memberId: "MEM_test",
      }),
    });
  });

  await page.route(`${API_URL}/api/restaurants/own`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        restaurants: [testRestaurant],
      }),
    });
  });

  await page.route(`${API_URL}/api/tables/restaurant/restaurant-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        tables: [testTable],
      }),
    });
  });

  await page.route(`${API_URL}/api/menu/restaurant/restaurant-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        menu: testMenu,
      }),
    });
  });

  await page.route(`${API_URL}/api/menu/restaurant/restaurant-test-1/available`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        menu: testMenu,
      }),
    });
  });

  await page.route(`${API_URL}/api/sessions/restaurant/restaurant-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sessions: [testSession],
      }),
    });
  });

  await page.route(`${API_URL}/api/order/session/session-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        orders: [],
      }),
    });
  });

  await page.route(`${API_URL}/api/suggestion/session/session-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        suggestions: [],
      }),
    });
  });

  await page.route(`${API_URL}/api/bill/session/session-test-1`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Bill not found",
      }),
    });
  });

  await page.route(`${API_URL}/api/payment/session/session-test-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        payments: [],
      }),
    });
  });
}
