require('dotenv').config({ override: true })

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