const { defineConfig, env } = require('prisma/config')
require('dotenv').config({ override: true })

module.exports = defineConfig(
  {
    schema: 'prisma/schema.prisma',
    migrations: 'prisma/migrations',
  },
  {
    class: {
      datasource: {
        url: env('DATABASE_URL'),
      },
    },
  }
)