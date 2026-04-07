import 'dotenv/config';
import { db } from './db/db';
import { matches, commentary } from './db/schema';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test by checking if tables exist
    const matchCount = await db.select().from(matches).limit(1);
    console.log('✅ Matches table accessible');
    
    const commentaryCount = await db.select().from(commentary).limit(1);
    console.log('✅ Commentary table accessible');
    
    console.log('\n✅ Database connection successful!');
    console.log('Your sports application schema is ready.');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    process.exit(0);
  }
}

testConnection();
