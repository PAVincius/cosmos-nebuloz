const { Client } = require("pg");
const c = new Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/cosmos_dev",
});
c.connect()
  .then(() =>
    c.query(
      'SELECT password FROM "Account" WHERE "accountId" = \'admin@cosmos.local\''
    )
  )
  .then((r) => {
    console.log(`${r.rows[0]?.password?.substring(0, 30)}...`);
    c.end();
  })
  .catch((e) => {
    console.error(e.message);
    c.end();
  });
