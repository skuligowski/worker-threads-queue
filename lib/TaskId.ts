let id = 0;
const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let seed = randomString(4);

export default (prefix: string) => {
  if (id % 99999 === 0) {
    seed = randomString(4);
    id = 0;
  }
  return `${prefix}.${seed}.${++id}`;
};

function randomString(count: number): string {
  let result = '';
  for (var i = count; i > 0; --i)
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  return result;
}
