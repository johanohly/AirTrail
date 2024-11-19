const readline = require('readline');

const args = process.argv.slice(2);
const message = args[0] || 'Are you sure you want to proceed? (yes/no)';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(`${message}: `, (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    process.exit(0);
  } else {
    console.log('Operation aborted.');
    rl.close();
    process.exit(1);
  }
});
