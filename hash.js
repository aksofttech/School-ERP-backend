const bcrypt = require("bcrypt");

async function run() {
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

run();
