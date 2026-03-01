// test-connector.js
import { fetchInstagramMentions, fetchAllInstagramMentions } from './lib/connectors/instagram.js';

async function test() {
  // Test 1 tempat
  const tempat = {
    id: 1,
    name: 'Kopi Kenangan',
    latitude: -7.7609,
    longitude: 112.7291
  };
  
  console.log('=== Test Single Place ===');
  const signals = await fetchInstagramMentions(tempat);
  console.log(signals);
  
  // Test banyak tempat
  console.log('\n=== Test Multiple Places ===');
  const tempatList = [
    { id: 1, name: 'Kopi Kenangan' },
    { id: 2, name: 'Warung Mbok Bro' }
  ];
  const allSignals = await fetchAllInstagramMentions(tempatList);
  console.log(`Total signals: ${allSignals.length}`);
}

test();