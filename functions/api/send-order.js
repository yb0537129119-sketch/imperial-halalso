function clean(value, max = 1000) {
  return String(value ?? "").replace(/[<>]/g, "").slice(0, max);
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: "חסר מפתח Resend ב-Cloudflare" }), {
      status: 503, headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "נתוני ההזמנה אינם תקינים" }), {
      status: 400, headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const items = Array.isArray(data.items) ? data.items.slice(0, 100) : [];
  const lines = [
    "התקבלה הזמנה חדשה מאתר אולמי אימפריאל",
    "",
    `מספר הזמנה: #${clean(data.orderNumber, 30)}`,
    `שם: ${clean(data.name, 120)}`,
    `טלפון: ${clean(data.phone, 40)}`,
    `מייל הלקוח: ${clean(data.email, 200)}`,
    `סוג אירוע: ${clean(data.eventType, 100)}`,
    `תאריך אירוע: ${clean(data.date, 40)}`,
    `מוזמנים: ${clean(data.guests, 20) || "לא צוין"}`,
    `מיקום: ${clean(data.location, 200) || "לא צוין"}`,
    `כתובת: ${clean(data.address, 300) || "לא צוין"}`,
    `הערות: ${clean(data.notes, 1000) || "אין"}`,
    `חוזה: ${data.contractAccepted ? "אושר ונחתם" : "לא אושר"}`,
    "",
    "מנות שנבחרו:",
    ...(items.length ? items.map(item => `- ${clean(item.category, 80)}: ${clean(item.name, 160)}`) : ["לא נבחרו מנות"])
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Imperial Website <onboarding@resend.dev>",
      to: ["yehudaa148@gmail.com"],
      subject: `הזמנה חדשה מאולמי אימפריאל #${clean(data.orderNumber, 30)}`,
      text: lines.join("\n")
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return new Response(JSON.stringify({
      success: false,
      error: result.message || result.name || "שירות המייל החזיר שגיאה"
    }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  return new Response(JSON.stringify({ success: true, id: result.id || null }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
