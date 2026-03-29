import fs from 'fs';
const data = JSON.parse(fs.readFileSync('src/data/track.json'));
console.log(`Track has ${data.blocks.length} blocks`);
const start = data.blocks.find(b => b.type === 'start');
const finish = data.blocks.find(b => b.type === 'finish');
const checkpoints = data.blocks.filter(b => b.type === 'checkpoint');
console.log(`Start: ${!!start}, Finish: ${!!finish}, Checkpoints: ${checkpoints.length}`);
