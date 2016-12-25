import { Search } from './index';

async function main() {
  let search = new Search('https://aws.amazon.com/');
  const results = await search.detectVendors();
  console.dir(results);
}

main();
