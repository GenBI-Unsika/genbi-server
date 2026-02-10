import fetch from 'node-fetch';

async function testSearch(query) {
    try {
        const response = await fetch(`http://localhost:4000/api/v1/public/search?q=${query}`);
        const data = await response.json();
        console.log(`Results for "${query}":`, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
    }
}

async function run() {
    await testSearch('Tips');
    await testSearch('Tentang');
}

run();
