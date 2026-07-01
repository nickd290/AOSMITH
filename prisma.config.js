// Do not override injected env (e.g. Railway DATABASE_URL during db push / deploy).
require('dotenv').config({ override: !process.env.DATABASE_URL })

const { defineConfig } = require('prisma/config')

module.exports = defineConfig(
  {
    schema: 'prisma/schema.prisma',
    migrations: 'prisma/migrations',
  },
  {
    class: {
      datasource: {
        url: process.env.DATABASE_URL,  // Now uses loaded env
      },
    },
  }
)