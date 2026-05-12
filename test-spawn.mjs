import { spawn } from 'node:child_process';
const child = spawn(
  'node_modules\\\\.bin\\\\next.cmd',
  ['build', '--webpack'],
  { stdio: 'pipe' }
);
child.stdout.on('data', d => console.log('OUT:', d.length));
child.stderr.on('data', d => console.error('ERR:', d.toString()));
child.on('close', code => console.log('Exited with:', code));
