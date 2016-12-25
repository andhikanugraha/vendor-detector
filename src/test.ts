import { Search } from './index';

async function main() {
  let search = new Search('https://www.salestockindonesia.com/');
  const results = await search.detectVendors();
  console.dir(results);
}

main();
