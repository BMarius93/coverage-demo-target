# coverage-demo-target

A small TypeScript library with **deliberately low test coverage**. It is the demo target for the
[TS Coverage Improver](https://github.com/MariusBedrule/kraken): the service scans this repo, finds files
below the coverage threshold and opens pull requests that add tests.

## Modules

| File | What it does | Interesting branches |
| --- | --- | --- |
| `src/date-parser.ts` | Parses ISO / EU / US date strings | leap years, month lengths, invalid formats |
| `src/price-calculator.ts` | Line-item totals with discounts, tax and rounding | 3 discount kinds, rounding modes, range errors |
| `src/string-validator.ts` | Email, slug, password policy, IBAN mod-97 | policy flags, normalisation |
| `src/ttl-cache.ts` | In-memory cache with TTL, size limit and stats | expiry, eviction, async loader |
| `src/user-service.ts` | User API client over an injected `HttpClient` | 404/409/5xx handling, retries |

## Usage

```bash
npm install
npm test              # run tests
npm run test:coverage # run tests with a coverage table
npm run build         # compile to dist/
```

Starting coverage (lines) is between 0% and ~32% per file, so every module is a candidate for improvement.
