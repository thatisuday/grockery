import { start } from '.';
import fs from 'fs';
import path from 'path';

start({
  yaml: fs.readFileSync(path.resolve(__dirname, './types.yaml'), {
    encoding: 'utf-8',
  }),
});
