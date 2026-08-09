#!/bin/bash
set -e

echo "🔧 Script para diagnosticar y reparar sincronización iCal"
echo "=========================================================="
echo ""

# Paso 1: Verificar que hay URLs iCal configuradas
echo "1️⃣ Verificando URLs iCal configuradas..."
echo ""
echo "Para ver las URLs iCal de tus propiedades, ejecuta:"
echo "  npm run dev"
echo "  Luego ve a: http://localhost:3000/properties"
echo "  Y verifica el campo 'iCal URL' en cada propiedad"
echo ""

# Paso 2: Trigger manual del sync
echo "2️⃣ Ejecutar sincronización iCal manual..."
echo ""
echo "Ejecuta este comando (reemplaza CRON_SECRET con tu valor real):"
echo ""
echo "  curl -H 'Authorization: Bearer YOUR_CRON_SECRET' \\"
echo "    http://localhost:3000/api/sync/ical"
echo ""

# Paso 3: Importar CSV
echo "3️⃣ Opción: Importar directamente desde CSV..."
echo ""
echo "Si el iCal no funciona, puedes importar el CSV:"
echo ""
echo "  curl -X POST http://localhost:3000/api/sync/csv-import \\"
echo "    -H 'Authorization: Bearer YOUR_CRON_SECRET' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"csv\": \"Propiedad,Huesped,Listing,...\n...\"}'  "
echo ""

echo ""
echo "📋 Resumen de cambios realizados:"
echo "=================================="
echo "✅ Mejorado parser iCal para buscar códigos en más campos"
echo "✅ Creado script de diagnóstico: lib/ical-debug.ts"
echo "✅ Creado endpoint de importación CSV: app/api/sync/csv-import/route.ts"
echo ""
echo "Los confirmation codes ahora se buscan en:"
echo "  - UID del evento"
echo "  - Description"
echo "  - Summary"
echo "  - Location"
echo "  - URL"
echo ""
