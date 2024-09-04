#!/bin/sh

bunx prisma migrate deploy

exec bun ./build