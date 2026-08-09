// Debug script para inspeccionar el iCal feed de Airbnb
// Uso: npx ts-node lib/ical-debug.ts

import ical from "node-ical";

export async function debugIcalUrl(icalUrl: string) {
  console.log("🔍 Inspeccionando iCal feed...\n");

  try {
    const events = await ical.async.fromURL(icalUrl);

    console.log(`📊 Total eventos: ${Object.keys(events).length}\n`);

    let eventCount = 0;
    for (const key in events) {
      const event = events[key];
      if (!event || event.type !== "VEVENT") continue;

      eventCount++;

      if (eventCount <= 5) {
        // Show first 5 events in detail
        console.log(`\n📌 Evento ${eventCount}:`);
        console.log(`   UID: ${event.uid}`);
        console.log(`   Summary: ${event.summary}`);
        console.log(`   Description: ${event.description ? event.description.substring(0, 100) : "N/A"}`);
        console.log(`   Location: ${event.location || "N/A"}`);
        console.log(`   URL: ${event.url || "N/A"}`);
        console.log(`   Start: ${event.start}`);
        console.log(`   End: ${event.end}`);
        console.log(`   Status: ${event.status || "N/A"}`);

        // Print ALL available properties
        console.log(`   \n   ⚙️ Todas las propiedades:`);
        Object.keys(event).forEach((prop) => {
          const value = (event as any)[prop];
          if (typeof value !== "object" && typeof value !== "function") {
            console.log(`      ${prop}: ${value}`);
          }
        });
      }
    }

    console.log(`\n\n📈 RESUMEN: ${eventCount} eventos VEVENT encontrados`);

    if (eventCount === 0) {
      console.warn(
        "⚠️ NO SE ENCONTRARON EVENTOS - El feed podría estar vacío o en un formato no estándar"
      );
    }
  } catch (error) {
    console.error("❌ Error al procesar iCal:", error);
  }
}

// Test con una propiedad (requiere que configures esto)
const testUrl = process.env.AIRBNB_ICAL_URL || "";
if (testUrl) {
  debugIcalUrl(testUrl).catch(console.error);
} else {
  console.log("⚠️ Proporciona una URL iCal en la variable AIRBNB_ICAL_URL");
}
