#!/bin/sh
set -e
prisma generate
prisma migrate deploy
exec node server.js
