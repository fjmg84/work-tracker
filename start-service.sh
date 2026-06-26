#!/bin/bash

# Script de inicio para Work Tracker en modo producción
# Ejecutar desde el directorio del proyecto: ./start-service.sh

echo "Construyendo Work Tracker..."
npm run build

echo "Iniciando Work Tracker en modo producción..."
NODE_ENV=production npx electron .
