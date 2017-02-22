import { VendorManager } from './VendorManager';
import { detectVendors } from './Search';


async function main() {
  const results = await detectVendors('https://www.joomla.org');
  console.log('\nFinal results:');
  console.dir(results, { colors: true, depth: 4 });

  const vm = VendorManager.getInstance();
  const availableVendors = vm.vendors;
  console.dir(availableVendors.get('Joomla'));
}

main();
