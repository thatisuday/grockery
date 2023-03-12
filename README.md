# grockery \[**WIP**\]

A stateful GraphQL mock library.

### How to install?

```bash
npm install --save-dev grockery #or
yarn add --dev grockery
```

### How to use?

#### Create a YAML config file (./types.yaml)

```YAML
dbConfig:
  filepath: mock.json
  resetOnStart: false
entities:
  User:
    name: String!
    age: Int
  Machine:
    name: String!
    active: Boolean!
    date: String
```

- dbConfig: Database configuration to store mock data.
  - filepath: Path of this mock data file (.json) on the filesystem.
  - resetOnStart: remove old mock data from this file when server is restarted.
- entities: GraphQL entities.

#### Create mock-server.ts (or .js file)

```ts
import { start } from '../src';
import fs from 'fs';
import path from 'path';

start({
  yaml: fs.readFileSync(path.resolve(__dirname, './types.yaml'), {
    encoding: 'utf-8',
  }),
});
```

#### Execute mock-server.ts with node

```bash
ts-node mock-server.ts
# 🚀 Grockery server listening at: http://localhost:4200/
```
