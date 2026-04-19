const port = process.env.PORT ?? '3000';
const response = await fetch(`http://127.0.0.1:${port}/api/ping`);

if (!response.ok) {
  process.exit(1);
}

const body = await response.text();
process.exit(body.trim() === 'pong' ? 0 : 1);
