// eslint-plugin-cosmos — custom rules for Cosmos monorepo
const requireSecureActionWrapper = require("./src/rules/require-secure-action-wrapper");

module.exports = {
  rules: {
    "require-secure-action-wrapper": requireSecureActionWrapper,
  },
  configs: {
    recommended: {
      plugins: ["cosmos"],
      rules: {
        "cosmos/require-secure-action-wrapper": "warn",
      },
    },
  },
};
